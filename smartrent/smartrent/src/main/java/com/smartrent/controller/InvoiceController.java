package com.smartrent.controller;

import com.smartrent.dto.request.InvoiceRequest;
import com.smartrent.dto.response.InvoiceResponse;
import com.smartrent.entity.Invoice;
import com.smartrent.service.InvoiceService;
import com.smartrent.util.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.smartrent.service.PdfService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.util.List;

@RestController
@RequestMapping("/api/v1/invoices")
@RequiredArgsConstructor
public class InvoiceController {

    private final InvoiceService invoiceService;
    private final PdfService pdfService;


    @PostMapping
    public ResponseEntity<ApiResponse<InvoiceResponse>> create(
            @Valid @RequestBody InvoiceRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(invoiceService.create(request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<InvoiceResponse>>> getAll(
            @RequestParam(required = false) Invoice.Status status) {
        List<InvoiceResponse> result = (status != null)
                ? invoiceService.getByStatus(status)
                : invoiceService.getAll();
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<InvoiceResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(invoiceService.getById(id)));
    }

    @GetMapping("/contract/{contractId}")
    public ResponseEntity<ApiResponse<List<InvoiceResponse>>> getByContract(
            @PathVariable Long contractId) {
        return ResponseEntity.ok(ApiResponse.success(invoiceService.getByContract(contractId)));
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> downloadPdf(@PathVariable Long id) {
        InvoiceResponse invoice = invoiceService.getById(id);
        byte[] pdf = pdfService.generateInvoicePdf(invoice);

        String filename = "hoadon_" + id + "_thang"
                + invoice.getBillingMonth().getMonthValue()
                + "_" + invoice.getBillingMonth().getYear() + ".pdf";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @PatchMapping("/{id}/mark-paid")
    public ResponseEntity<ApiResponse<InvoiceResponse>> markAsPaid(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(invoiceService.markAsPaid(id)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        invoiceService.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}