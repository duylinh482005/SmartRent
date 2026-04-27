package com.smartrent.service.impl;

import com.smartrent.dto.request.PropertyRequest;
import com.smartrent.dto.response.PropertyResponse;
import com.smartrent.entity.Property;
import com.smartrent.entity.User;
import com.smartrent.repository.PropertyRepository;
import com.smartrent.repository.UserRepository;
import com.smartrent.service.PropertyService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class PropertyServiceImpl implements PropertyService {

    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;

    @Override
    public PropertyResponse create(PropertyRequest request) {
        User owner = userRepository.findById(request.getOwnerId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy user id: " + request.getOwnerId()));

        if (propertyRepository.existsByNameAndOwnerId(request.getName(), request.getOwnerId())) {
            throw new RuntimeException("Khu trọ '" + request.getName() + "' đã tồn tại");
        }

        Property property = Property.builder()
                .name(request.getName())
                .address(request.getAddress())
                .description(request.getDescription())
                .owner(owner)
                .build();

        return toResponse(propertyRepository.save(property));
    }

    @Override
    @Transactional(readOnly = true)
    public PropertyResponse getById(Long id) {
        Property property = findById(id);
        return toResponse(property);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PropertyResponse> getAll() {
        return propertyRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PropertyResponse> getByOwner(Long ownerId) {
        return propertyRepository.findByOwnerId(ownerId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public PropertyResponse update(Long id, PropertyRequest request) {
        Property property = findById(id);

        if (propertyRepository.existsByNameAndOwnerIdAndIdNot(
                request.getName(), property.getOwner().getId(), property.getId())) {
            throw new RuntimeException("Khu trọ '" + request.getName() + "' đã tồn tại");
        }

        property.setName(request.getName());
        property.setAddress(request.getAddress());
        property.setDescription(request.getDescription());
        return toResponse(propertyRepository.save(property));
    }

    @Override
    public void delete(Long id) {
        Property property = findById(id);
        propertyRepository.delete(property);
    }

    private Property findById(Long id) {
        return propertyRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khu trọ id: " + id));
    }

    private PropertyResponse toResponse(Property p) {
        return PropertyResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .address(p.getAddress())
                .description(p.getDescription())
                .ownerId(p.getOwner().getId())
                .ownerUsername(p.getOwner().getUsername())
                .totalRooms(p.getRooms().size())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
