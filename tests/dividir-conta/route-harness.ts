import { readFile } from "node:fs/promises";
import { Script, createContext } from "node:vm";
import ts from "typescript";

type Handler = (req: Request, context?: unknown) => Promise<Response>;

// Compile the ACTUAL route into a VM with an explicit dependency allowlist.
// No Next server, Prisma client, dotenv, sockets or application credentials.
export async function carregarRota(file: string, mocks: Record<string, unknown>) {
  const source = await readFile(file, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  });
  const sandboxModule = { exports: {} as Record<string, Handler> };
  const context = createContext({
    module: sandboxModule, exports: sandboxModule.exports, Response, Request, URL, Buffer, Error,
    process: { env: { DIVIDIR_CONTA_ENABLED: "false", SUMUP_MERCHANT_CODE: "merchant-test" } },
    console: { warn() {}, error() {}, log() {} },
    require(name: string) {
      if (name === "next/server") return { NextResponse: { json: Response.json.bind(Response) } };
      if (Object.hasOwn(mocks, name)) return mocks[name];
      throw new Error(`Unmocked dependency forbidden: ${name}`);
    },
  });
  new Script(outputText, { filename: file }).runInContext(context, { timeout: 1000 });
  return sandboxModule.exports;
}

export function requisicao(body: unknown, query = "") {
  const req = new Request(`https://isolated.invalid/api${query}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return Object.assign(req, { nextUrl: new URL(req.url) });
}
