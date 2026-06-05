"""
LLM call sites for AutoCommand.

One module per agent. Each module exposes a single async function with typed
input and output. No tool-calling loops; these are narrow translation steps.
"""
