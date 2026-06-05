package com.smartrent.service;

import com.smartrent.dto.response.InvoiceResponse;

public interface PdfService {

    byte[] generateInvoicePdf(InvoiceResponse invoice, OwnerInfo owner);

    record OwnerInfo(
            String bankName,
            String bankAccountNumber,
            String bankAccountName,
            String qrCodeUrl
    ) {}
}
