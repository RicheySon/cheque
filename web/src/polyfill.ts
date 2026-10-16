import { Buffer as NodeBuffer } from "buffer";

declare global {
  var Buffer: typeof NodeBuffer;
}

globalThis.Buffer = NodeBuffer;
