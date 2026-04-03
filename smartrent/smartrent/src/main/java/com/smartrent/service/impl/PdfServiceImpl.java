package com.smartrent.service.impl;

import com.lowagie.text.*;
import com.lowagie.text.Font;
import com.lowagie.text.Rectangle;
import com.lowagie.text.pdf.*;
import com.smartrent.dto.response.InvoiceResponse;
import com.smartrent.service.PdfService;
import org.springframework.stereotype.Service;
import org.springframework.util.ResourceUtils;

import java.awt.*;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Service
public class PdfServiceImpl implements PdfService {

    private static final NumberFormat VND = NumberFormat.getInstance(new Locale("vi", "VN"));
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("MM/yyyy");

    @Override
    public byte[] generateInvoicePdf(InvoiceResponse invoice) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            Document doc = new Document(PageSize.A4, 40, 40, 50, 40);
            PdfWriter.getInstance(doc, out);
            doc.open();

            // Load font tiếng Việt
            BaseFont baseFont = BaseFont.createFont(
                    loadFontPath("fonts/Roboto-Regular.ttf"),
                    BaseFont.IDENTITY_H, BaseFont.EMBEDDED);
            BaseFont boldFont = BaseFont.createFont(
                    loadFontPath("fonts/Roboto-Bold.ttf"),
                    BaseFont.IDENTITY_H, BaseFont.EMBEDDED);

            Font titleFont    = new Font(boldFont, 18, Font.NORMAL, new Color(30, 80, 160));
            Font subTitleFont = new Font(boldFont, 11, Font.NORMAL, new Color(60, 60, 60));
            Font headerFont   = new Font(boldFont, 10, Font.NORMAL, Color.WHITE);
            Font normalFont   = new Font(baseFont, 10, Font.NORMAL, new Color(40, 40, 40));
            Font boldSmall    = new Font(boldFont, 10, Font.NORMAL, new Color(40, 40, 40));
            Font totalFont    = new Font(boldFont, 12, Font.NORMAL, new Color(200, 50, 50));
            Font statusFont   = new Font(boldFont, 11, Font.NORMAL,
                    invoice.getStatus().name().equals("PAID")
                            ? new Color(0, 150, 80) : new Color(200, 100, 0));

            // ── HEADER ──────────────────────────────────────────────
            PdfPTable header = new PdfPTable(2);
            header.setWidthPercentage(100);
            header.setWidths(new float[]{3f, 1.5f});
            header.setSpacingAfter(16);

            // Tên công ty bên trái
            PdfPCell companyCell = new PdfPCell();
            companyCell.setBorder(Rectangle.NO_BORDER);
            companyCell.addElement(new Paragraph("SMARTRENT", titleFont));
            Paragraph subP = new Paragraph("Hệ thống quản lý phòng trọ thông minh", subTitleFont);
            companyCell.addElement(subP);
            header.addCell(companyCell);

            // Thông tin hóa đơn bên phải
            PdfPCell infoCell = new PdfPCell();
            infoCell.setBorder(Rectangle.NO_BORDER);
            infoCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
            infoCell.addElement(new Paragraph("HÓA ĐƠN TIỀN PHÒNG", boldSmall));
            infoCell.addElement(new Paragraph(
                    "Số: #" + String.format("%05d", invoice.getId()), normalFont));
            infoCell.addElement(new Paragraph(
                    "Tháng: " + invoice.getBillingMonth().format(MONTH_FMT), normalFont));
            infoCell.addElement(new Paragraph(
                    "Ngày tạo: " + invoice.getCreatedAt().format(
                            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")), normalFont));
            header.addCell(infoCell);

            doc.add(header);

            // Đường kẻ ngang
            drawHorizontalLine(doc, new Color(30, 80, 160), 2f);
            doc.add(Chunk.NEWLINE);

            // ── THÔNG TIN KHÁCH THUÊ ─────────────────────────────────
            doc.add(new Paragraph("THÔNG TIN KHÁCH THUÊ", subTitleFont));
            doc.add(Chunk.NEWLINE);

            PdfPTable tenantTable = new PdfPTable(2);
            tenantTable.setWidthPercentage(100);
            tenantTable.setSpacingAfter(16);
            addInfoRow(tenantTable, "Họ và tên:",   invoice.getTenantName(),   boldSmall, normalFont);
            addInfoRow(tenantTable, "Khu trọ:",     invoice.getPropertyName(), boldSmall, normalFont);
            addInfoRow(tenantTable, "Phòng:",       invoice.getRoomNumber(),   boldSmall, normalFont);
            doc.add(tenantTable);

            // ── BẢNG CHI TIẾT ────────────────────────────────────────
            doc.add(new Paragraph("CHI TIẾT HÓA ĐƠN", subTitleFont));
            doc.add(Chunk.NEWLINE);

            PdfPTable detailTable = new PdfPTable(4);
            detailTable.setWidthPercentage(100);
            detailTable.setWidths(new float[]{3f, 2f, 2f, 2f});
            detailTable.setSpacingAfter(16);

            // Header row
            Color headerBg = new Color(30, 80, 160);
            addTableHeader(detailTable, "Khoản mục",    headerFont, headerBg);
            addTableHeader(detailTable, "Số lượng",     headerFont, headerBg);
            addTableHeader(detailTable, "Đơn giá",      headerFont, headerBg);
            addTableHeader(detailTable, "Thành tiền",   headerFont, headerBg);

            // Tiền phòng
            addDetailRow(detailTable,
                    "Tiền phòng tháng " + invoice.getBillingMonth().format(MONTH_FMT),
                    "1 tháng",
                    formatVnd(invoice.getRoomFee()),
                    formatVnd(invoice.getRoomFee()),
                    normalFont, boldSmall, false);

            // Tiền điện
            addDetailRow(detailTable,
                    "Tiền điện\n(Cũ: " + invoice.getElectricOld()
                            + " → Mới: " + invoice.getElectricNew() + ")",
                    invoice.getElectricUsed() + " kWh",
                    formatVnd(invoice.getElectricUnitPrice()) + "/kWh",
                    formatVnd(invoice.getElectricFee()),
                    normalFont, boldSmall, true);

            // Tiền nước
            addDetailRow(detailTable,
                    "Tiền nước\n(Cũ: " + invoice.getWaterOld()
                            + " → Mới: " + invoice.getWaterNew() + ")",
                    invoice.getWaterUsed() + " m³",
                    formatVnd(invoice.getWaterUnitPrice()) + "/m³",
                    formatVnd(invoice.getWaterFee()),
                    normalFont, boldSmall, false);

            // Dịch vụ
            addDetailRow(detailTable,
                    "Phí dịch vụ (thang máy, máy giặt, dọn rác)",
                    invoice.getServicePeople() + " người",
                    formatVnd(invoice.getServiceUnitPrice()) + "/người",
                    formatVnd(invoice.getServiceFee()),
                    normalFont, boldSmall, true);

            // Mạng
            addDetailRow(detailTable,
                    "Phí mạng",
                    "1 tháng",
                    formatVnd(invoice.getNetworkUnitPrice()),
                    formatVnd(invoice.getNetworkFee()),
                    normalFont, boldSmall, false);

            doc.add(detailTable);

            // ── TỔNG TIỀN ────────────────────────────────────────────
            PdfPTable totalTable = new PdfPTable(2);
            totalTable.setWidthPercentage(50);
            totalTable.setHorizontalAlignment(Element.ALIGN_RIGHT);
            totalTable.setSpacingAfter(20);

            PdfPCell totalLabelCell = new PdfPCell(new Phrase("TỔNG CỘNG:", boldSmall));
            totalLabelCell.setBorder(Rectangle.TOP);
            totalLabelCell.setPadding(8);
            totalTable.addCell(totalLabelCell);

            PdfPCell totalValueCell = new PdfPCell(
                    new Phrase(formatVnd(invoice.getTotalAmount()) + " đ", totalFont));
            totalValueCell.setBorder(Rectangle.TOP);
            totalValueCell.setPadding(8);
            totalValueCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
            totalTable.addCell(totalValueCell);

            doc.add(totalTable);

            // ── TRẠNG THÁI ───────────────────────────────────────────
            Paragraph statusPara = new Paragraph(
                    "Trạng thái: " + (invoice.getStatus().name().equals("PAID")
                            ? "✓ ĐÃ THANH TOÁN" : "⚠ CHƯA THANH TOÁN"),
                    statusFont);
            statusPara.setAlignment(Element.ALIGN_CENTER);
            doc.add(statusPara);

            // ── FOOTER ───────────────────────────────────────────────
            doc.add(Chunk.NEWLINE);
            drawHorizontalLine(doc, new Color(200, 200, 200), 0.5f);
            Font footerFont = new Font(baseFont, 8, Font.ITALIC, new Color(150, 150, 150));
            Paragraph footer = new Paragraph(
                    "Hóa đơn được tạo tự động bởi hệ thống SmartRent. "
                            + "Mọi thắc mắc vui lòng liên hệ quản lý khu trọ.", footerFont);
            footer.setAlignment(Element.ALIGN_CENTER);
            doc.add(footer);

            doc.close();
            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Lỗi khi tạo PDF: " + e.getMessage(), e);
        }
    }

    // ── Helper methods ───────────────────────────────────────────────

    private String loadFontPath(String resourcePath) throws Exception {
        File file = ResourceUtils.getFile("classpath:" + resourcePath);
        return file.getAbsolutePath();
    }

    private void drawHorizontalLine(Document doc, Color color, float width) throws Exception {
        PdfPTable line = new PdfPTable(1);
        line.setWidthPercentage(100);
        PdfPCell cell = new PdfPCell();
        cell.setBorderColor(color);
        cell.setBorderWidthTop(width);
        cell.setBorderWidthBottom(0);
        cell.setBorderWidthLeft(0);
        cell.setBorderWidthRight(0);
        cell.setFixedHeight(1);
        line.addCell(cell);
        doc.add(line);
    }

    private void addInfoRow(PdfPTable table, String label, String value,
                            Font labelFont, Font valueFont) {
        PdfPCell lc = new PdfPCell(new Phrase(label, labelFont));
        lc.setBorder(Rectangle.NO_BORDER);
        lc.setPaddingBottom(4);
        table.addCell(lc);

        PdfPCell vc = new PdfPCell(new Phrase(value != null ? value : "", valueFont));
        vc.setBorder(Rectangle.NO_BORDER);
        vc.setPaddingBottom(4);
        table.addCell(vc);
    }

    private void addTableHeader(PdfPTable table, String text, Font font, Color bg) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBackgroundColor(bg);
        cell.setPadding(8);
        cell.setHorizontalAlignment(Element.ALIGN_CENTER);
        table.addCell(cell);
    }

    private void addDetailRow(PdfPTable table, String item, String qty,
                              String unitPrice, String amount,
                              Font normalFont, Font boldFont, boolean shaded) {
        Color bg = shaded ? new Color(245, 248, 255) : Color.WHITE;

        PdfPCell c1 = new PdfPCell(new Phrase(item, normalFont));
        c1.setPadding(7); c1.setBackgroundColor(bg);
        table.addCell(c1);

        PdfPCell c2 = new PdfPCell(new Phrase(qty, normalFont));
        c2.setPadding(7); c2.setBackgroundColor(bg);
        c2.setHorizontalAlignment(Element.ALIGN_CENTER);
        table.addCell(c2);

        PdfPCell c3 = new PdfPCell(new Phrase(unitPrice, normalFont));
        c3.setPadding(7); c3.setBackgroundColor(bg);
        c3.setHorizontalAlignment(Element.ALIGN_RIGHT);
        table.addCell(c3);

        PdfPCell c4 = new PdfPCell(new Phrase(amount, boldFont));
        c4.setPadding(7); c4.setBackgroundColor(bg);
        c4.setHorizontalAlignment(Element.ALIGN_RIGHT);
        table.addCell(c4);
    }

    private String formatVnd(java.math.BigDecimal amount) {
        if (amount == null) return "0";
        return VND.format(amount.longValue());
    }
}
