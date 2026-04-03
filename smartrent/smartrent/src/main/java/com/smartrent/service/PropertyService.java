package com.smartrent.service;

import com.smartrent.dto.request.PropertyRequest;
import com.smartrent.dto.response.PropertyResponse;

import java.util.List;

public interface PropertyService {
    PropertyResponse create(PropertyRequest request);
    PropertyResponse getById(Long id);
    List<PropertyResponse> getAll();
    List<PropertyResponse> getByOwner(Long ownerId);
    PropertyResponse update(Long id, PropertyRequest request);
    void delete(Long id);
}