package com.smartrent.service.impl;

import com.smartrent.dto.request.PropertyRequest;
import com.smartrent.dto.response.PropertyResponse;
import com.smartrent.entity.Property;
import com.smartrent.entity.User;
import com.smartrent.entity.Room;
import com.smartrent.repository.PropertyRepository;
import com.smartrent.repository.RoomRepository;
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
    private final RoomRepository roomRepository;

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
                .electricUnitPrice(request.getElectricUnitPrice() != null ? request.getElectricUnitPrice() : new java.math.BigDecimal("3500"))
                .waterUnitPrice(request.getWaterUnitPrice() != null ? request.getWaterUnitPrice() : new java.math.BigDecimal("15000"))
                .serviceUnitPrice(request.getServiceUnitPrice() != null ? request.getServiceUnitPrice() : java.math.BigDecimal.ZERO)
                .networkFee(request.getNetworkFee() != null ? request.getNetworkFee() : java.math.BigDecimal.ZERO)
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
        if (request.getElectricUnitPrice() != null) property.setElectricUnitPrice(request.getElectricUnitPrice());
        if (request.getWaterUnitPrice() != null) property.setWaterUnitPrice(request.getWaterUnitPrice());
        if (request.getServiceUnitPrice() != null) property.setServiceUnitPrice(request.getServiceUnitPrice());
        if (request.getNetworkFee() != null) property.setNetworkFee(request.getNetworkFee());
        return toResponse(propertyRepository.save(property));
    }

    @Override
    public void delete(Long id) {
        Property property = findById(id);
        if (roomRepository.existsByPropertyIdAndStatus(property.getId(), Room.Status.OCCUPIED)) {
            throw new RuntimeException("Không thể xóa khu trọ đang có phòng được thuê. Hãy chấm dứt các hợp đồng trước.");
        }
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
                .electricUnitPrice(p.getElectricUnitPrice())
                .waterUnitPrice(p.getWaterUnitPrice())
                .serviceUnitPrice(p.getServiceUnitPrice())
                .networkFee(p.getNetworkFee())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
