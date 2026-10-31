#!/usr/bin/env python3
"""
Asset Data Group — de-identification tool, local web UI.

A single-file, standard-library web front-end for people who would rather drag a
file in than use the command line. It runs the SAME deid.py behind the scenes.

    python3 serve.py           # then open http://127.0.0.1:8000

By default it binds to 127.0.0.1 (this machine only) — the file you choose is
processed locally and nothing is sent anywhere. Pass --host 0.0.0.0 only when you
intend to expose it (e.g. inside a container on a trusted network).
"""

import argparse
import http.server
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
DEID = os.path.join(HERE, "deid.py")
PYEXE = sys.executable

PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Asset Data Group — De-identification</title>
<style>
  :root{--dc:#4f46e5;--dc-d:#3730a3;--ink:#0a2540;--mut:#64748b;--line:#e2e8f0;--ok:#047857}
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;margin:0;background:#f8fafc;color:#0f172a}
  header{background:#fff;border-bottom:1px solid var(--line);padding:16px 24px;display:flex;align-items:center;gap:12px}
  .mark{display:grid;place-items:center;height:34px;width:34px;border-radius:9px;color:#fff;font-weight:800;background:linear-gradient(135deg,#6366f1,#4f46e5)}
  h1{font-size:17px;margin:0;color:var(--ink)} .sub{font-size:12px;color:var(--mut);margin:0}
  main{max-width:900px;margin:24px auto;padding:0 20px}
  .card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:22px;box-shadow:0 1px 2px rgba(0,0,0,.04);margin-bottom:18px}
  .drop{border:2px dashed #c7ccf7;border-radius:12px;padding:30px;text-align:center;color:var(--mut);cursor:pointer;transition:.15s}
  .drop.hover{border-color:var(--dc);background:#eef0fe} .drop b{color:var(--ink)}
  .row{display:flex;flex-wrap:wrap;gap:18px;align-items:center;margin-top:16px}
  fieldset{border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin:0} legend{font-size:12px;color:var(--mut);padding:0 6px}
  label{font-size:14px;margin-right:14px;cursor:pointer}
  button{background:var(--dc);color:#fff;border:0;border-radius:9px;padding:11px 22px;font-size:14px;font-weight:700;cursor:pointer}
  button:disabled{opacity:.5;cursor:default}
  .note{font-size:12px;color:var(--mut);margin-top:10px} .priv{color:var(--ok);font-weight:600}
  pre{background:#0b1220;color:#d7e0ef;border-radius:10px;padding:16px;overflow:auto;font-size:12.5px;line-height:1.5;max-height:460px}
  .dl{background:var(--ok)} .hidden{display:none} .err{color:#b91c1c;font-weight:600}
  table{border-collapse:collapse;width:100%;font-size:12px;margin-top:10px;display:block;overflow:auto;max-height:320px}
  th,td{border:1px solid var(--line);padding:5px 8px;text-align:left;white-space:nowrap} th{background:#f1f5f9;position:sticky;top:0}
</style></head><body>
<header><span class="mark">A</span><div><h1>Asset Data Group — De-identification</h1><p class="sub">Runs on this machine. Your data never leaves.</p></div></header>
<main>
  <div class="card">
    <div id="drop" class="drop"><b>Drop a file here</b> or click to choose &nbsp;·&nbsp; CSV, TSV, JSON, JSONL, Parquet, or Excel
      <div id="fname" class="note"></div></div>
    <input id="file" type="file" class="hidden" accept=".csv,.tsv,.json,.jsonl,.parquet,.xlsx"/>
    <div class="row">
      <fieldset><legend>What to do</legend>
        <label><input type="radio" name="mode" value="detect"/> Detect rules</label>
        <label><input type="radio" name="mode" value="dryrun" checked/> Dry run (report only)</label>
        <label><input type="radio" name="mode" value="apply"/> De-identify</label>
        <label><input type="radio" name="mode" value="package"/> De-identify + package</label>
      </fieldset>
      <fieldset><legend>Profile</legend>
        <label><input type="checkbox" id="hipaa"/> HIPAA Safe Harbor</label>
      </fieldset>
      <fieldset id="titlewrap" class="hidden"><legend>Package title</legend>
        <input id="title" placeholder="e.g. Field-service operational dataset" style="border:1px solid #cbd5e1;border-radius:6px;padding:5px 8px;font-size:13px;min-width:230px">
      </fieldset>
      <button id="run" disabled>Run</button>
    </div>
    <p class="note"><span class="priv">Private:</span> the file is processed locally by this tool and is not uploaded anywhere.</p>
  </div>
  <div id="out" class="card hidden">
    <div id="dlwrap" class="hidden" style="margin-bottom:14px"><button id="dl" class="dl">Download cleaned file</button> <button id="dlpkg" class="dl hidden">Download package (HTML)</button></div>
    <div id="pkgwrap" class="hidden" style="margin-bottom:14px"><h3 style="font-size:14px;margin:0 0 8px;color:var(--ink)">Buyer package preview</h3><iframe id="pkgframe" style="width:100%;height:520px;border:1px solid var(--line);border-radius:10px"></iframe></div>
    <div id="preview"></div>
    <h3 style="font-size:14px;margin:16px 0 8px;color:var(--ink)">Audit report</h3>
    <pre id="report"></pre>
  </div>
</main>
<script>
(function(){
  var file=null, cleaned=null, cleanedName="cleaned.csv", pkg=null;
  var drop=document.getElementById("drop"), input=document.getElementById("file");
  var runBtn=document.getElementById("run"), out=document.getElementById("out");
  function setFile(f){ file=f; document.getElementById("fname").textContent=f?("Selected: "+f.name):""; runBtn.disabled=!f; }
  drop.addEventListener("click",function(){input.click();});
  input.addEventListener("change",function(){ if(input.files[0]) setFile(input.files[0]); });
  ["dragover","dragenter"].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add("hover");}));
  ["dragleave","drop"].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove("hover");}));
  drop.addEventListener("drop",ev=>{ if(ev.dataTransfer.files[0]) setFile(ev.dataTransfer.files[0]); });
  function esc(s){return String(s==null?"":s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));}
  function preview(csv){
    var lines=csv.split(/\\r?\\n/).filter(x=>x).slice(0,8);
    if(!lines.length) return "";
    function cells(l){var o=[],cur="",q=false;for(var i=0;i<l.length;i++){var c=l[i];if(c=='"'){q=!q;}else if(c==","&&!q){o.push(cur);cur="";}else cur+=c;}o.push(cur);return o;}
    var h=cells(lines[0]);
    var t="<table><thead><tr>"+h.map(x=>"<th>"+esc(x)+"</th>").join("")+"</tr></thead><tbody>";
    for(var i=1;i<lines.length;i++){t+="<tr>"+cells(lines[i]).map(x=>"<td>"+esc(x)+"</td>").join("")+"</tr>";}
    return t+"</tbody></table>";
  }
  runBtn.addEventListener("click",async function(){
    if(!file) return;
    var mode=document.querySelector('input[name=mode]:checked').value;
    var profile=document.getElementById("hipaa").checked?"hipaa-safe-harbor":"";
    runBtn.disabled=true; runBtn.textContent="Working…"; out.classList.add("hidden");
    try{
      var buf=await file.arrayBuffer();
      var q="?mode="+mode+"&profile="+encodeURIComponent(profile)+"&filename="+encodeURIComponent(file.name)+"&title="+encodeURIComponent(document.getElementById("title").value||"");
      var r=await fetch("/api/process"+q,{method:"POST",body:buf});
      var d=await r.json();
      var rep=document.getElementById("report"), dlwrap=document.getElementById("dlwrap"), pv=document.getElementById("preview");
      var dlpkg=document.getElementById("dlpkg"), pkgwrap=document.getElementById("pkgwrap");
      dlwrap.classList.add("hidden"); dlpkg.classList.add("hidden"); pkgwrap.classList.add("hidden"); pv.innerHTML="";
      if(d.error){ rep.innerHTML='<span class="err">Error: '+esc(d.error)+'</span>\\n'+esc(d.log||""); }
      else if(d.mode==="detect"){ rep.textContent="Proposed rules (review, edit, then run):\\n\\n"+d.plan; }
      else {
        rep.textContent=d.report_txt||d.log||"(no report)";
        if((d.mode==="apply"||d.mode==="package") && d.cleaned_csv){ cleaned=d.cleaned_csv; cleanedName=d.filename||"cleaned.csv";
          dlwrap.classList.remove("hidden"); pv.innerHTML="<b style='font-size:13px'>Cleaned preview (first rows)</b>"+preview(cleaned); }
        if(d.mode==="package" && d.package_html){ pkg=d.package_html; dlpkg.classList.remove("hidden");
          pkgwrap.classList.remove("hidden"); document.getElementById("pkgframe").srcdoc=d.package_html; }
      }
      out.classList.remove("hidden");
    }catch(e){ document.getElementById("report").innerHTML='<span class="err">'+esc(e.message)+'</span>'; out.classList.remove("hidden"); }
    runBtn.disabled=false; runBtn.textContent="Run";
  });
  document.getElementById("dl").addEventListener("click",function(){
    var b=new Blob([cleaned],{type:"text/csv"}); var a=document.createElement("a");
    a.href=URL.createObjectURL(b); a.download=cleanedName; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  });
  document.getElementById("dlpkg").addEventListener("click",function(){
    if(!pkg) return; var b=new Blob([pkg],{type:"text/html"}); var a=document.createElement("a");
    a.href=URL.createObjectURL(b); a.download="data-package.html"; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  });
  Array.prototype.forEach.call(document.querySelectorAll('input[name=mode]'),function(r){
    r.addEventListener("change",function(){ document.getElementById("titlewrap").classList.toggle("hidden", document.querySelector('input[name=mode]:checked').value!=="package"); });
  });
})();
</script></body></html>"""


def read(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""


def run_deid(mode, inp, profile, workdir, title=""):
    base = [PYEXE, DEID, "-i", inp]
    if profile == "hipaa-safe-harbor":
        base += ["--profile", "hipaa-safe-harbor"]
    if mode == "detect":
        p = subprocess.run(base + ["--detect"], capture_output=True, text=True)
        return {"mode": "detect", "plan": p.stdout, "log": p.stderr}
    rep = os.path.join(workdir, "report")
    if mode == "dryrun":
        p = subprocess.run(base + ["--dry-run", "-r", rep], capture_output=True, text=True)
        return {"mode": "dryrun", "report_txt": read(rep + ".txt"),
                "report_json": read(rep + ".json"), "log": p.stderr}
    outp = os.path.join(workdir, "cleaned.csv")
    p = subprocess.run(base + ["--out-format", "csv", "-o", outp, "-r", rep], capture_output=True, text=True)
    if mode == "package":
        pkg = os.path.join(workdir, "package.html")
        pargs = [PYEXE, os.path.join(HERE, "package.py"), "-i", outp, "--report", rep + ".json", "-o", pkg]
        if title:
            pargs += ["--title", title]
        pp = subprocess.run(pargs, capture_output=True, text=True)
        return {"mode": "package", "report_txt": read(rep + ".txt"), "cleaned_csv": read(outp),
                "package_html": read(pkg), "filename": "cleaned.csv", "log": (p.stderr or "") + (pp.stderr or "")}
    return {"mode": "apply", "report_txt": read(rep + ".txt"), "report_json": read(rep + ".json"),
            "cleaned_csv": read(outp), "filename": "cleaned.csv", "log": p.stderr}


class Handler(http.server.BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        b = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        if self.path == "/" or self.path.startswith("/?"):
            self._send(200, PAGE, "text/html; charset=utf-8")
        else:
            self._send(404, "not found", "text/plain")

    def do_POST(self):
        if not self.path.startswith("/api/process"):
            self._send(404, json.dumps({"error": "not found"}))
            return
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        mode = q.get("mode", ["dryrun"])[0]
        profile = q.get("profile", [""])[0]
        fname = q.get("filename", ["input.csv"])[0]
        title = q.get("title", [""])[0]
        length = int(self.headers.get("Content-Length", "0") or "0")
        data = self.rfile.read(length) if length else b""
        ext = os.path.splitext(fname)[1] or ".csv"
        workdir = tempfile.mkdtemp(prefix="adgdeid_")
        inp = os.path.join(workdir, "input" + ext)
        try:
            with open(inp, "wb") as f:
                f.write(data)
            self._send(200, json.dumps(run_deid(mode, inp, profile, workdir, title)))
        except Exception as e:
            self._send(200, json.dumps({"error": str(e)}))
        finally:
            shutil.rmtree(workdir, ignore_errors=True)

    def log_message(self, *a):
        pass


def main():
    ap = argparse.ArgumentParser(description="Local web UI for the ADG de-identification tool")
    ap.add_argument("--host", default="127.0.0.1", help="bind host (default 127.0.0.1 = this machine only)")
    ap.add_argument("--port", type=int, default=8000)
    args = ap.parse_args()
    httpd = http.server.ThreadingHTTPServer((args.host, args.port), Handler)
    sys.stderr.write("Asset Data Group de-identification UI running at http://%s:%d  (Ctrl-C to stop)\n"
                     % ("127.0.0.1" if args.host == "127.0.0.1" else args.host, args.port))
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
