package com.smartrent.service;

import com.smartrent.dto.request.TenantRequest;
import com.smartrent.dto.response.TenantResponse;

import java.util.List;

public interface TenantService {
    TenantResponse create(TenantRequest request);
    TenantResponse getById(Long id);
    List<TenantResponse> getAll();
    TenantResponse update(Long id, TenantRequest request);
    void delete(Long id);
}