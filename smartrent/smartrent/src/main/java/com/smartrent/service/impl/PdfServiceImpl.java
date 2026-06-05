package com.smartrent.service.impl;

import com.lowagie.text.*;
import com.lowagie.text.Font;
import com.lowagie.text.Image;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.*;
import com.smartrent.dto.response.InvoiceResponse;
import com.smartrent.entity.Invoice;
import com.smartrent.service.PdfService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.ResourceUtils;

import java.awt.*;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
public class PdfServiceImpl implements PdfService {

    private static final NumberFormat VND       = NumberFormat.getInstance(new Locale("vi", "VN"));
    private static final DateTimeFormatter DATE  = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("MM/yyyy");
    private static final DateTimeFormatter DT    = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private static final Color PRIMARY    = new Color(30, 80, 160);
    private static final Color ROW_ALT    = new Color(245, 248, 255);
    private static final Color BORDER_CLR = new Color(210, 218, 230);
    private static final Color TEXT_DARK  = new Color(26, 26, 46);
    private static final Color TEXT_GRAY  = new Color(107, 114, 128);
    private static final Color GREEN      = new Color(5, 150, 105);
    private static final Color ORANGE     = new Color(217, 119, 6);
    private static final Color RED_TOTAL  = new Color(185, 28, 28);

    private final Path uploadRootDir;

    public PdfServiceImpl(@Value("${app.upload.dir:uploads}") String uploadDir) {
        this.uploadRootDir = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    @Override
    public byte[] generateInvoicePdf(InvoiceResponse inv, OwnerInfo owner) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            // A5 portrait — compact, screenshot-friendly
            Document doc = new Document(PageSize.A5, 25, 25, 28, 22);
            PdfWriter.getInstance(doc, out);
            doc.open();

            BaseFont base = BaseFont.createFont(loadFontPath("fonts/Roboto-Regular.ttf"),
                    BaseFont.IDENTITY_H, BaseFont.EMBEDDED);
            BaseFont bold = BaseFont.createFont(loadFontPath("fonts/Roboto-Bold.ttf"),
                    BaseFont.IDENTITY_H, BaseFont.EMBEDDED);

            Font fTitle    = new Font(bold,  15,   Font.NORMAL, PRIMARY);
            Font fSub      = new Font(base,   7.5f, Font.NORMAL, TEXT_GRAY);
            Font fDocTitle = new Font(bold,   9,    Font.NORMAL, PRIMARY);
            Font fMeta     = new Font(base,   7.5f, Font.NORMAL, TEXT_GRAY);
            Font fLabel    = new Font(bold,   8,    Font.NORMAL, TEXT_DARK);
            Font fValue    = new Font(base,   8,    Font.NORMAL, TEXT_DARK);
            Font fTH       = new Font(bold,   8,    Font.NORMAL, Color.WHITE);
            Font fCell     = new Font(base,   8,    Font.NORMAL, TEXT_DARK);
            Font fCellBold = new Font(bold,   8,    Font.NORMAL, TEXT_DARK);
            Font fTotal    = new Font(bold,  13,    Font.NORMAL, RED_TOTAL);
            Font fFooter   = new Font(base,   6.5f, Font.ITALIC, TEXT_GRAY);

            // ── HEADER ──────────────────────────────────────────────
            PdfPTable hdr = new PdfPTable(2);
            hdr.setWidthPercentage(100);
            hdr.setWidths(new float[]{3f, 2.2f});
            hdr.setSpacingAfter(6);

            PdfPCell brand = noBorder();
            brand.addElement(new Paragraph("SMARTRENT", fTitle));
            brand.addElement(new Paragraph("Hệ thống quản lý phòng trọ thông minh", fSub));
            hdr.addCell(brand);

            PdfPCell meta = noBorder();
            meta.setHorizontalAlignment(Element.ALIGN_RIGHT);
            meta.addElement(rPara("HÓA ĐƠN TIỀN PHÒNG", fDocTitle));
            meta.addElement(rPara("Số: #" + String.format("%05d", inv.getId()), fMeta));
            meta.addElement(rPara("Tháng: " + inv.getBillingMonth().format(MONTH), fMeta));
            meta.addElement(rPara("Ngày tạo: " + inv.getCreatedAt().format(DT), fMeta));
            hdr.addCell(meta);
            doc.add(hdr);

            hLine(doc, PRIMARY, 1.5f);
            doc.add(gap(4));

            // ── THÔNG TIN KHÁCH ──────────────────────────────────────
            PdfPTable info = new PdfPTable(4);
            info.setWidthPercentage(100);
            info.setWidths(new float[]{1.4f, 2.8f, 1.2f, 1.8f});
            info.setSpacingAfter(6);

            infoCell(info, "Khách thuê:", fLabel);
            infoCell(info, inv.getTenantName(), fValue);
            infoCell(info, "Khu trọ:", fLabel);
            infoCell(info, inv.getPropertyName(), fValue);
            infoCell(info, "Phòng:", fLabel);
            infoCell(info, inv.getRoomNumber(), fValue);
            infoCell(info, "Hạn T.toán:", fLabel);
            infoCell(info, inv.getDueDate() != null ? inv.getDueDate().format(DATE) : "—", fValue);
            doc.add(info);

            hLine(doc, BORDER_CLR, 0.5f);
            doc.add(gap(4));

            // ── BẢNG CHI TIẾT ────────────────────────────────────────
            PdfPTable tbl = new PdfPTable(4);
            tbl.setWidthPercentage(100);
            tbl.setWidths(new float[]{3.5f, 1.6f, 2f, 1.8f});
            tbl.setSpacingAfter(8);

            th(tbl, "Khoản mục",  fTH);
            th(tbl, "Số lượng",   fTH);
            th(tbl, "Đơn giá",    fTH);
            th(tbl, "Thành tiền", fTH);

            boolean isFirstMonth = inv.getDepositFee() != null
                    && inv.getDepositFee().compareTo(java.math.BigDecimal.ZERO) > 0;
            int rowIdx = 0;

            if (isFirstMonth) {
                td(tbl,
                    "Tiền đặt cọc (1 tháng)",
                    "1 tháng",
                    vnd(inv.getDepositFee()) + " đ",
                    vnd(inv.getDepositFee()) + " đ",
                    fCell, fCellBold, rowIdx++ % 2 != 0);
            }

            td(tbl,
                "Tiền phòng tháng " + inv.getBillingMonth().format(MONTH),
                "1 tháng",
                vnd(inv.getRoomFee()) + " đ",
                vnd(inv.getRoomFee()) + " đ",
                fCell, fCellBold, rowIdx++ % 2 != 0);

            if (!isFirstMonth) {
                td(tbl,
                    "Điện (cũ " + inv.getElectricOld() + " → mới " + inv.getElectricNew() + ")",
                    inv.getElectricUsed() + " kWh",
                    vnd(inv.getElectricUnitPrice()) + "/kWh",
                    vnd(inv.getElectricFee()) + " đ",
                    fCell, fCellBold, rowIdx++ % 2 != 0);

                td(tbl,
                    "Nước (cũ " + inv.getWaterOld() + " → mới " + inv.getWaterNew() + ")",
                    inv.getWaterUsed() + " m³",
                    vnd(inv.getWaterUnitPrice()) + "/m³",
                    vnd(inv.getWaterFee()) + " đ",
                    fCell, fCellBold, rowIdx++ % 2 != 0);
            }

            td(tbl,
                "Phí dịch vụ",
                inv.getServicePeople() + " người",
                vnd(inv.getServiceUnitPrice()) + "/ng",
                vnd(inv.getServiceFee()) + " đ",
                fCell, fCellBold, rowIdx++ % 2 != 0);

            td(tbl,
                "Phí mạng",
                "1 tháng",
                vnd(inv.getNetworkUnitPrice()) + " đ",
                vnd(inv.getNetworkFee()) + " đ",
                fCell, fCellBold, rowIdx % 2 != 0);

            doc.add(tbl);

            // ── TỔNG TIỀN & QR ───────────────────────────────────────
            PdfPTable bottom = new PdfPTable(2);
            bottom.setWidthPercentage(100);
            bottom.setWidths(new float[]{1.6f, 1f});
            bottom.setSpacingAfter(6);

            // Ô trái: tổng + trạng thái
            PdfPCell leftCell = new PdfPCell();
            leftCell.setBorder(Rectangle.BOX);
            leftCell.setBorderColor(BORDER_CLR);
            leftCell.setBackgroundColor(new Color(248, 250, 255));
            leftCell.setPadding(10);

            leftCell.addElement(new Paragraph("TỔNG CỘNG", new Font(bold, 7.5f, Font.NORMAL, TEXT_GRAY)));
            leftCell.addElement(new Paragraph(vnd(inv.getTotalAmount()) + " đ", fTotal));
            leftCell.addElement(gap(4));

            boolean isPaid    = Invoice.Status.PAID.equals(inv.getStatus());
            boolean isOverdue = Invoice.Status.OVERDUE.equals(inv.getStatus());
            Color   stColor   = isPaid ? GREEN : (isOverdue ? RED_TOTAL : ORANGE);
            String  stText    = isPaid ? "✓ ĐÃ THANH TOÁN" : (isOverdue ? "⚠ QUÁ HẠN" : "⏳ CHƯA THANH TOÁN");
            leftCell.addElement(new Paragraph(stText, new Font(bold, 9, Font.NORMAL, stColor)));

            if (isPaid && inv.getPaidAt() != null) {
                leftCell.addElement(gap(3));
                Font fPaid = new Font(base, 7, Font.NORMAL, TEXT_GRAY);
                leftCell.addElement(new Paragraph("Thanh toán: " + inv.getPaidAt().format(DT), fPaid));
                if (inv.getPaymentConfirmedBy() != null) {
                    leftCell.addElement(new Paragraph("Xác nhận bởi: " + inv.getPaymentConfirmedBy(), fPaid));
                }
            }
            bottom.addCell(leftCell);

            // Ô phải: QR + thông tin ngân hàng
            PdfPCell rightCell = new PdfPCell();
            rightCell.setBorder(Rectangle.BOX);
            rightCell.setBorderColor(BORDER_CLR);
            rightCell.setBackgroundColor(Color.WHITE);
            rightCell.setPadding(8);
            rightCell.setHorizontalAlignment(Element.ALIGN_CENTER);
            rightCell.setVerticalAlignment(Element.ALIGN_MIDDLE);

            boolean hasBank = owner != null &&
                    owner.bankName() != null && !owner.bankName().isBlank();
            boolean hasQr   = owner != null &&
                    owner.qrCodeUrl() != null && !owner.qrCodeUrl().isBlank();

            if (hasQr || hasBank) {
                Font fBankTitle = new Font(bold, 7.5f, Font.NORMAL, PRIMARY);
                Font fBank      = new Font(base, 7.5f, Font.NORMAL, TEXT_DARK);
                Font fBankBold  = new Font(bold, 7.5f, Font.NORMAL, TEXT_DARK);

                Paragraph payTitle = new Paragraph("THANH TOÁN CHUYỂN KHOẢN", fBankTitle);
                payTitle.setAlignment(Element.ALIGN_CENTER);
                rightCell.addElement(payTitle);
                rightCell.addElement(gap(3));

                if (hasQr) {
                    Image qr = loadQrImage(owner.qrCodeUrl());
                    if (qr != null) {
                        qr.setAlignment(Image.ALIGN_CENTER);
                        rightCell.addElement(qr);
                        rightCell.addElement(gap(3));
                    }
                }

                if (hasBank) {
                    Paragraph bName = new Paragraph(owner.bankName(), fBankBold);
                    bName.setAlignment(Element.ALIGN_CENTER);
                    rightCell.addElement(bName);
                }
                if (owner.bankAccountNumber() != null && !owner.bankAccountNumber().isBlank()) {
                    Paragraph acct = new Paragraph("STK: " + owner.bankAccountNumber(), fBank);
                    acct.setAlignment(Element.ALIGN_CENTER);
                    rightCell.addElement(acct);
                }
                if (owner.bankAccountName() != null && !owner.bankAccountName().isBlank()) {
                    Paragraph acctName = new Paragraph(owner.bankAccountName(), fBankBold);
                    acctName.setAlignment(Element.ALIGN_CENTER);
                    rightCell.addElement(acctName);
                }
            } else {
                Paragraph contact = new Paragraph(
                        "Liên hệ chủ trọ\nđể biết thông tin\nthanh toán",
                        new Font(base, 7.5f, Font.ITALIC, TEXT_GRAY));
                contact.setAlignment(Element.ALIGN_CENTER);
                rightCell.addElement(contact);
            }
            bottom.addCell(rightCell);
            doc.add(bottom);

            // ── FOOTER ───────────────────────────────────────────────
            hLine(doc, BORDER_CLR, 0.5f);
            doc.add(gap(3));
            Paragraph footer = new Paragraph(
                    "Hóa đơn được tạo tự động bởi SmartRent  •  Liên hệ quản lý khu trọ nếu có thắc mắc",
                    fFooter);
            footer.setAlignment(Element.ALIGN_CENTER);
            doc.add(footer);

            doc.close();
            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Lỗi khi tạo PDF: " + e.getMessage(), e);
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────

    private String loadFontPath(String res) throws Exception {
        File f = ResourceUtils.getFile("classpath:" + res);
        return f.getAbsolutePath();
    }

    private void hLine(Document doc, Color color, float w) throws Exception {
        PdfPTable t = new PdfPTable(1);
        t.setWidthPercentage(100);
        PdfPCell c = new PdfPCell();
        c.setBorderColor(color);
        c.setBorderWidthTop(w);
        c.setBorderWidthBottom(0);
        c.setBorderWidthLeft(0);
        c.setBorderWidthRight(0);
        c.setFixedHeight(1);
        t.addCell(c);
        doc.add(t);
    }

    private Paragraph gap(float h) {
        Paragraph p = new Paragraph(" ");
        p.setLeading(h);
        return p;
    }

    private Paragraph rPara(String text, Font font) {
        Paragraph p = new Paragraph(text, font);
        p.setAlignment(Element.ALIGN_RIGHT);
        return p;
    }

    private PdfPCell noBorder() {
        PdfPCell c = new PdfPCell();
        c.setBorder(Rectangle.NO_BORDER);
        c.setPaddingBottom(2);
        return c;
    }

    private void infoCell(PdfPTable t, String text, Font font) {
        PdfPCell c = new PdfPCell(new Phrase(text != null ? text : "—", font));
        c.setBorder(Rectangle.NO_BORDER);
        c.setPaddingBottom(3);
        c.setPaddingTop(1);
        t.addCell(c);
    }

    private void th(PdfPTable t, String text, Font font) {
        PdfPCell c = new PdfPCell(new Phrase(text, font));
        c.setBackgroundColor(PRIMARY);
        c.setBorderColor(new Color(20, 60, 130));
        c.setPadding(5);
        c.setHorizontalAlignment(Element.ALIGN_CENTER);
        t.addCell(c);
    }

    private void td(PdfPTable t, String item, String qty, String unitPrice, String amount,
                    Font nf, Font bf, boolean shaded) {
        Color bg = shaded ? ROW_ALT : Color.WHITE;

        PdfPCell c1 = new PdfPCell(new Phrase(item, nf));
        c1.setPadding(5); c1.setBackgroundColor(bg); c1.setBorderColor(BORDER_CLR);
        t.addCell(c1);

        PdfPCell c2 = new PdfPCell(new Phrase(qty, nf));
        c2.setPadding(5); c2.setBackgroundColor(bg); c2.setBorderColor(BORDER_CLR);
        c2.setHorizontalAlignment(Element.ALIGN_CENTER);
        t.addCell(c2);

        PdfPCell c3 = new PdfPCell(new Phrase(unitPrice, nf));
        c3.setPadding(5); c3.setBackgroundColor(bg); c3.setBorderColor(BORDER_CLR);
        c3.setHorizontalAlignment(Element.ALIGN_RIGHT);
        t.addCell(c3);

        PdfPCell c4 = new PdfPCell(new Phrase(amount, bf));
        c4.setPadding(5); c4.setBackgroundColor(bg); c4.setBorderColor(BORDER_CLR);
        c4.setHorizontalAlignment(Element.ALIGN_RIGHT);
        t.addCell(c4);
    }

    private Image loadQrImage(String qrCodeUrl) {
        try {
            int idx = qrCodeUrl.indexOf("/uploads/");
            String rel = idx >= 0 ? qrCodeUrl.substring(idx + "/uploads/".length()) : qrCodeUrl;
            Path p = uploadRootDir.resolve(rel);
            if (!Files.exists(p)) return null;
            Image img = Image.getInstance(p.toAbsolutePath().toString());
            img.scaleToFit(78, 78);
            return img;
        } catch (Exception e) {
            return null;
        }
    }

    private String vnd(java.math.BigDecimal amount) {
        if (amount == null) return "0";
        return VND.format(amount.longValue());
    }
}
