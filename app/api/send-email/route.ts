import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { isValidEmail } from "@/lib/utils";

const MAX_HTML_LENGTH = 20_000;
const MAX_PDF_BASE64_LENGTH = 8_000_000;

export async function POST(req: NextRequest) {
  try {
    const expectedToken = process.env.NEXT_PUBLIC_API_TOKEN;
    if (!expectedToken || req.headers.get("x-api-token") !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid email request." }, { status: 400 });
    }

    const { to, subject, html, pdfBase64, pdfFilename } = body as Record<string, unknown>;
    const recipient = typeof to === "string" ? to.trim() : "";
    const mailSubject = typeof subject === "string" ? subject.trim() : "";
    const mailHtml = typeof html === "string" ? html : "";
    const attachment = typeof pdfBase64 === "string" ? pdfBase64 : "";

    if (!isValidEmail(recipient) || /[,;\r\n]/.test(recipient)) {
      return NextResponse.json({ error: "Guest email address is invalid." }, { status: 400 });
    }

    if (!mailSubject.startsWith("Sommarbukt") || mailSubject.length > 200 || /[\r\n]/.test(mailSubject)) {
      return NextResponse.json({ error: "Email subject is invalid." }, { status: 400 });
    }

    if (!mailHtml || mailHtml.length > MAX_HTML_LENGTH) {
      return NextResponse.json({ error: "Email content is invalid or too large." }, { status: 400 });
    }

    if (!attachment || !/^[A-Za-z0-9+/=]+$/.test(attachment) || attachment.length > MAX_PDF_BASE64_LENGTH) {
      return NextResponse.json({ error: "PDF attachment is invalid or too large." }, { status: 400 });
    }

    const safeFilename = sanitizePdfFilename(pdfFilename);

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT) || 587;

    if (!host || !user || !pass) {
      return NextResponse.json({ error: "SMTP settings are incomplete." }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      requireTLS: port === 587,
    });

    await transporter.sendMail({
      from: `"Sommarbukt Boats" <${user}>`,
      to: recipient,
      subject: mailSubject,
      html: mailHtml,
      attachments: [{
        filename: safeFilename,
        content: Buffer.from(attachment, "base64"),
        contentType: "application/pdf",
      }],
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Email error:", error);
    return NextResponse.json({ error: "Email could not be sent." }, { status: 500 });
  }
}

function sanitizePdfFilename(value: unknown) {
  const fallback = "sommarbukt-rental.pdf";
  if (typeof value !== "string" || !value.trim()) return fallback;

  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|\r\n]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 120);

  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned}.pdf`;
}
