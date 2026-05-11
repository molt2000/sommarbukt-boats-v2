import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: NextRequest) {
  try {
    const { to, subject, html, pdfBase64, pdfFilename } = await req.json();

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,          // e.g. smtps.udag.de (United Domains)
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,        // e.g. boats@sommarbukt.com
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Sommarbukt Boats" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
      attachments: pdfBase64
        ? [{ filename: pdfFilename || "sommarbukt-rental.pdf", content: Buffer.from(pdfBase64, "base64"), contentType: "application/pdf" }]
        : [],
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Email error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
