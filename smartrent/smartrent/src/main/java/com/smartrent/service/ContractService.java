package com.smartrent.service;

import com.smartrent.dto.request.ContractRequest;
import com.smartrent.dto.response.ContractResponse;
import com.smartrent.entity.Contract;

import java.util.List;

public interface ContractService {
    ContractResponse create(ContractRequest request);
    ContractResponse getById(Long id);
    List<ContractResponse> getAll();
    List<ContractResponse> getByRoom(Long roomId);
    List<ContractResponse> getByTenant(Long tenantId);
    ContractResponse terminate(Long id);
    void delete(Long id);
}