import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bucket: string }> }
) {
  const { bucket } = await params;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const customPath = formData.get("path") as string | null;

    if (!file) {
      return NextResponse.json({ error: { message: "No file provided" } }, { status: 400 });
    }

    const filename = customPath || `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", bucket);

    await fs.mkdir(uploadDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(uploadDir, path.basename(filename));

    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${bucket}/${path.basename(filename)}`;

    return NextResponse.json({
      data: {
        path: filename,
        fullPath: publicUrl,
        publicUrl,
      },
      error: null,
    });
  } catch (error: any) {
    console.error(`Storage upload error for ${bucket}:`, error);
    return NextResponse.json({ error: { message: error.message } }, { status: 500 });
  }
}
