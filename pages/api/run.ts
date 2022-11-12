import type { NextApiRequest, NextApiResponse } from "next";
import { exec } from "node:child_process";
import tmp from "tmp";
import fs from "node:fs";
import path from "node:path";
import getConfig from "next/config";
import { promisify } from "node:util";

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

interface TempDir {
  directory: string;
  cleanup(): void;
}

function tempDir(): Promise<TempDir> {
  return new Promise((resolve, reject) =>
    tmp.dir((err, directory, cleanup) => {
      if (err) {
        reject(err);
      } else {
        resolve({ directory, cleanup });
      }
    })
  );
}

const { serverRuntimeConfig } = getConfig();

export type Data = {
  success: boolean;
  exit_code?: number;
  compiler_output?: string;
  output?: string;
};

async function readOutput(directory: string, name: string): Promise<string> {
  const contents = await readFile(path.join(directory, name));

  return contents.toString("base64");
}

async function run(code: string, test: boolean): Promise<Data> {
  const { directory, cleanup } = await tempDir();
  try {
    const inputPath = path.join(directory, "program.alu");
    await writeFile(inputPath, code);

    const env = {
      ...process.env,
      ...(test ? { TEST: "1" } : {}),
    };

    try {
      await promisify(exec)(
        path.join(serverRuntimeConfig.PROJECT_ROOT, "./scripts/run.sh"),
        {
          env,
          cwd: directory,
        }
      );
    } catch (e) {
      return {
        success: false,
        compiler_output: await readOutput(directory, "compiler.output"),
      };
    }

    const exitCode = parseInt(
      await readFile(path.join(directory, "program.ret"), "utf-8")
    );

    return {
      success: true,
      exit_code: exitCode,
      compiler_output: await readOutput(directory, "compiler.output"),
      output: await readOutput(directory, "program.output"),
    };
  } finally {
    setImmediate(cleanup);
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method === "POST") {
    try {
      const code = req.body;
      if (code.length > 256 * 1024) {
        res.status(413).json({ error: "Code is too large" });
        return;
      }

      let response = await run(code, req.query.test === "1");
      res.status(200).json(response);
    } catch (e) {
      res.status(500).end();
    }
  } else {
    res.status(405).end();
  }
}
