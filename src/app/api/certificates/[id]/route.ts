import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { handler, ApiError, notFound } from "@/server/http";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { bloodLabel } from "@/lib/blood";
import { formatDate } from "@/lib/time";

// Standard PDF fonts only cover Latin-1; replace anything else so generation never fails.
const latin = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, "?");

export const GET = handler<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const d = await db.donation.findUnique({ where: { id: params.id }, include: { donor: { select: { name: true } }, center: { select: { name: true } } } });
  if (!d) notFound("Donation");
  if (d.donorId !== user.id && user.role !== "ADMIN") throw new ApiError(403, "FORBIDDEN", "This certificate belongs to someone else.");

  const pdf = await PDFDocument.create();
  pdf.setTitle(`LifeDrop donation certificate ${d.certificateNo}`);
  pdf.setAuthor("LifeDrop");
  const page = pdf.addPage([842, 595]); // A4 landscape
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const red = rgb(0.784, 0.063, 0.18);
  const grey = rgb(0.36, 0.36, 0.42);
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: red, borderWidth: 3 });
  page.drawRectangle({ x: 34, y: 34, width: width - 68, height: height - 68, borderColor: red, borderWidth: 0.75, opacity: 0 });
  const center = (text: string, y: number, size: number, f = font, color = rgb(0.1, 0.1, 0.12)) => {
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - w) / 2, y, size, font: f, color });
  };
  // Drop mark
  page.drawCircle({ x: width / 2, y: height - 105, size: 26, color: red });
  center("LifeDrop", height - 160, 16, bold, red);
  center("Certificate of Blood Donation", height - 210, 32, bold);
  center("This certifies that", height - 260, 14, font, grey);
  center(latin(d.donor.name), height - 300, 30, bold);
  center(`voluntarily donated ${d.volumeMl} ml of blood (group ${bloodLabel(d.bloodGroup)})`, height - 340, 15);
  center(`on ${formatDate(d.donatedAt)}${d.center ? ` at ${latin(d.center.name)}` : ""}.`, height - 362, 15);
  center("Thank you for giving the gift of life.", height - 410, 16, bold, red);
  page.drawText(`Certificate no. ${d.certificateNo}`, { x: 60, y: 60, size: 10, font, color: grey });
  const note = "Issued by LifeDrop. This certificate is a record of voluntary donation, not a medical document.";
  page.drawText(note, { x: width - 60 - font.widthOfTextAtSize(note, 9), y: 60, size: 9, font, color: grey });

  const bytes = await pdf.save();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="lifedrop-certificate-${d.certificateNo}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
});
