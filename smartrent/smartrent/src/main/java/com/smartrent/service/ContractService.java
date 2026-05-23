package com.smartrent.service;

import com.smartrent.dto.request.ContractRequest;
import com.smartrent.dto.request.ContractUpdateRequest;
import com.smartrent.dto.response.ContractResponse;

import java.util.List;

public interface ContractService {
    ContractResponse create(ContractRequest request);
    ContractResponse getById(Long id);
    List<ContractResponse> getAll();
    List<ContractResponse> getByRoom(Long roomId);
    List<ContractResponse> getByTenant(Long tenantId);
    ContractResponse terminate(Long id);
    ContractResponse update(Long id, ContractUpdateRequest request);
    void delete(Long id);
}