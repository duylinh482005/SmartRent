package com.smartrent.service;

import com.smartrent.dto.request.InvoiceRequest;
import com.smartrent.dto.request.InvoiceUpdateRequest;
import com.smartrent.dto.response.InvoiceResponse;
import com.smartrent.entity.Invoice;

import java.util.List;

public interface InvoiceService {
    InvoiceResponse create(InvoiceRequest request);
    InvoiceResponse createFirstMonthInvoice(Long contractId);
    InvoiceResponse update(Long id, InvoiceUpdateRequest request);
    InvoiceResponse getById(Long id);
    List<InvoiceResponse> getAll();
    List<InvoiceResponse> getByContract(Long contractId);
    List<InvoiceResponse> getByStatus(Invoice.Status status);
    InvoiceResponse markAsPaid(Long id);
    void delete(Long id);
}