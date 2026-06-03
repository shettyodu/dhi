Subject: DHI – setting up automated ordering, credit line & EDI with WESCO

Hi [Rep Name],

Digital Health International (DHI) is launching online ordering for the Keystone
lighting line we source through you, and we'd like orders to flow to WESCO
automatically — including order approval and credit — so neither team has to
re-key or chase each PO. Could you help us confirm the following so we can set it
up on our side?

1) ACCOUNT & CREDIT LINE
   - Approve DHI as a customer and establish a net-terms credit line.
   - What is our approved credit limit / ceiling? (We'll check available headroom
     before confirming a large order to a customer.)
   - Once the line is set, does each new PO draw against it automatically, with no
     per-order phone call or manual approval on your side?

2) EDI / ELECTRONIC ORDERING
   - Can we exchange orders via EDI? Please send your EDI specification / mapping
     guide and which transaction sets you support:
        850 (Purchase Order), 855 (PO Acknowledgment/approval),
        856 (Advance Ship Notice), 810 (Invoice), 846 (Inventory), 997 (Ack).
   - Your ISA/GS qualifiers & IDs and transport method (AS2 direct, or VAN).
   - Is order approval returned electronically on the 855 (machine), or does a
     person still approve large/credit-sensitive POs on your side?
   - Are you reachable as a trading partner through SPS Commerce / Orderful / Cleo?
     (If you're already on SPS, that's easiest for us.)

3) DROP-SHIP, FREIGHT & LEAD TIME
   - Confirm you drop-ship directly to our customers.
   - Do freight cost and estimated ship/lead time come back on the 856/810?
   - Is there any pre-order freight-quote API/feed? (If not, we'll show customers
     an estimate and finalize freight from your confirmation.)
   - Any ZIP/serviceability limits, accessorial charges, or AK/HI/PR handling.

4) TAX (so we're not double-taxed)
   - Please accept DHI's resale certificate per ship-to state so WESCO does not
     charge DHI sales tax on the wholesale cost (we collect/remit tax to the end
     customer).

5) PRODUCT & PRICING DATA
   - A current price file and the mapping of Keystone catalog numbers to your
     WESCO part numbers, so our POs reference the right SKUs and pricing.

6) PAPERWORK
   - Trading-partner / EDI agreement to sign, and a data-processing addendum (DPA)
     covering customer/credit information in the order flow.

Our goal is a hands-off flow: customer places a PO on our site → it's sent to
WESCO electronically → WESCO confirms the order and credit → WESCO ships and sends
tracking + invoice → we're billed on terms. Anything you can share on the above
(or a quick call with your EDI/credit team) would get us moving.

Thanks very much,
[Your Name]
Digital Health International
[phone] · [email]
