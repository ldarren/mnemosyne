#!/usr/bin/env node
import { main } from "@mariozechner/pi-coding-agent";
import { mnemosyneExtension } from "./extension.js";

process.title = "mnemosyne";

main(process.argv.slice(2), {
  extensionFactories: [mnemosyneExtension],
});
