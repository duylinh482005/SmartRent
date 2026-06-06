package com.smartrent.service.impl;

import com.smartrent.dto.request.ExpenseRequest;
import com.smartrent.dto.response.ExpenseResponse;
import com.smartrent.entity.Expense;
import com.smartrent.entity.Property;
import com.smartrent.repository.ExpenseRepository;
import com.smartrent.repository.PropertyRepository;
import com.smartrent.service.ExpenseService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class ExpenseServiceImpl implements ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final PropertyRepository propertyRepository;

    @Override
    public ExpenseResponse create(ExpenseRequest request) {
        Property property = propertyRepository.findByIdAndDeletedFalse(request.getPropertyId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khu trọ #" + request.getPropertyId()));

        Expense expense = Expense.builder()
                .property(property)
                .category(request.getCategory())
                .amount(request.getAmount())
                .description(request.getDescription())
                .expenseDate(request.getExpenseDate())
                .receiptImageUrl(request.getReceiptImageUrl())
                .build();

        return toResponse(expenseRepository.save(expense));
    }

    @Override
    public ExpenseResponse update(Long id, ExpenseRequest request) {
        Expense expense = expenseRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy chi phí #" + id));

        Property property = propertyRepository.findByIdAndDeletedFalse(request.getPropertyId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khu trọ #" + request.getPropertyId()));

        expense.setProperty(property);
        expense.setCategory(request.getCategory());
        expense.setAmount(request.getAmount());
        expense.setDescription(request.getDescription());
        expense.setExpenseDate(request.getExpenseDate());
        expense.setReceiptImageUrl(request.getReceiptImageUrl());

        return toResponse(expenseRepository.save(expense));
    }

    @Override
    @Transactional(readOnly = true)
    public ExpenseResponse getById(Long id) {
        return toResponse(expenseRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy chi phí #" + id)));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ExpenseResponse> getAll(Long propertyId, LocalDate from, LocalDate to) {
        List<Expense> expenses;
        if (propertyId != null && from != null && to != null) {
            expenses = expenseRepository.findByPropertyIdAndExpenseDateBetweenAndDeletedFalse(propertyId, from, to);
        } else if (propertyId != null) {
            expenses = expenseRepository.findByPropertyIdAndDeletedFalse(propertyId);
        } else if (from != null && to != null) {
            expenses = expenseRepository.findByExpenseDateBetweenAndDeletedFalse(from, to);
        } else {
            expenses = expenseRepository.findByDeletedFalse();
        }
        return expenses.stream().map(this::toResponse).toList();
    }

    @Override
    public void delete(Long id) {
        Expense expense = expenseRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy chi phí #" + id));
        String currentUser = SecurityContextHolder.getContext().getAuthentication().getName();
        expense.setDeleted(true);
        expense.setDeletedAt(LocalDateTime.now());
        expense.setDeletedBy(currentUser);
        expenseRepository.save(expense);
    }

    private ExpenseResponse toResponse(Expense e) {
        return ExpenseResponse.builder()
                .id(e.getId())
                .propertyId(e.getProperty().getId())
                .propertyName(e.getProperty().getName())
                .category(e.getCategory())
                .amount(e.getAmount())
                .description(e.getDescription())
                .expenseDate(e.getExpenseDate())
                .receiptImageUrl(e.getReceiptImageUrl())
                .createdAt(e.getCreatedAt())
                .build();
    }
}
