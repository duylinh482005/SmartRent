package com.smartrent.service;

import com.smartrent.dto.response.InvoiceResponse;

public interface PdfService {
    byte[] generateInvoicePdf(InvoiceResponse invoice);
}