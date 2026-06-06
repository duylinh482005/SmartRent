package com.smartrent.service;

import com.smartrent.dto.request.ExpenseRequest;
import com.smartrent.dto.response.ExpenseResponse;

import java.time.LocalDate;
import java.util.List;

public interface ExpenseService {
    ExpenseResponse create(ExpenseRequest request);
    ExpenseResponse update(Long id, ExpenseRequest request);
    ExpenseResponse getById(Long id);
    List<ExpenseResponse> getAll(Long propertyId, LocalDate from, LocalDate to);
    void delete(Long id);
}
