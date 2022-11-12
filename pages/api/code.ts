import type { NextApiRequest, NextApiResponse } from "next";
import { Data as RunData } from "./run";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { createHash } from "crypto";

const s3Client = new S3Client({ region: process.env.AWS_REGION });

type LoadCodeRequest = {
  code: string;
  result?: RunData;
};

async function save(
  request: LoadCodeRequest,
  res: NextApiResponse
): Promise<void> {
  const content = JSON.stringify(request);
  const id = createHash("sha256").update(content).digest("hex").slice(0, 16);

  if (content.length > 512 * 1024) {
    res.status(413).json({ error: "Code is too large" });
    return;
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: `shared/${id}`,
      Body: content,
    })
  );

  res.status(200).json({ id });
}

async function load(id: string, res: NextApiResponse): Promise<void> {
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET,
        Key: `shared/${id}`,
      })
    );

    res.writeHead(200, {
      "Content-Length": response.ContentLength!,
      "Content-Type": "application/json",
    });
    await (response.Body as any).pipe(res);
  } catch (e: any) {
    if (e.Code === "NoSuchKey") {
      res.status(404).json({ error: "Code snippet was not found" });
    } else {
      throw new Error("Failed to load code");
    }
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  try {
    if (req.method === "POST") {
      await save(JSON.parse(req.body), res);
    } else if (req.method === "GET") {
      await load(req.query.id as string, res);
    } else {
      res.status(405).end();
    }
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
}
