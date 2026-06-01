package com.smartrent.service.impl;

import com.smartrent.dto.request.PropertyRequest;
import com.smartrent.dto.response.PropertyResponse;
import com.smartrent.entity.Property;
import com.smartrent.entity.User;
import com.smartrent.entity.Room;
import com.smartrent.repository.InvoiceRepository;
import com.smartrent.repository.PropertyRepository;
import com.smartrent.repository.RoomRepository;
import com.smartrent.repository.UserRepository;
import com.smartrent.service.PropertyService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class PropertyServiceImpl implements PropertyService {

    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final RoomRepository roomRepository;
    private final InvoiceRepository invoiceRepository;

    @Override
    public PropertyResponse create(PropertyRequest request) {
        User owner = getCurrentUser();

        if (propertyRepository.existsByNameAndOwnerIdAndDeletedFalse(request.getName(), owner.getId())) {
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
        return toResponse(findById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<PropertyResponse> getAll() {
        return propertyRepository.findByDeletedFalse().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PropertyResponse> getByOwner(Long ownerId) {
        return propertyRepository.findByOwnerIdAndDeletedFalse(ownerId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public PropertyResponse update(Long id, PropertyRequest request) {
        Property property = findById(id);

        if (propertyRepository.existsByNameAndOwnerIdAndIdNotAndDeletedFalse(
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

        if (roomRepository.existsByPropertyIdAndStatusAndDeletedFalse(property.getId(), Room.Status.OCCUPIED)) {
            throw new RuntimeException("Không thể xóa khu trọ đang có phòng được thuê. Hãy chấm dứt các hợp đồng trước.");
        }

        if (invoiceRepository.existsPaidInvoiceByPropertyId(property.getId())) {
            throw new RuntimeException("Không thể xóa: Khu trọ đã có lịch sử thu tiền, cần lưu trữ để đối soát tài chính");
        }

        String deletedBy = getCurrentUsername();
        property.setDeleted(true);
        property.setDeletedAt(LocalDateTime.now());
        property.setDeletedBy(deletedBy);
        propertyRepository.save(property);
    }

    private Property findById(Long id) {
        return propertyRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khu trọ id: " + id));
    }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Không xác định được người dùng hiện tại"));
    }

    private String getCurrentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) return "system";
        String username = authentication.getName();
        if (username == null || username.isBlank() || "anonymousUser".equalsIgnoreCase(username)) return "system";
        return username;
    }

    private PropertyResponse toResponse(Property p) {
        return PropertyResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .address(p.getAddress())
                .description(p.getDescription())
                .ownerId(p.getOwner().getId())
                .ownerUsername(p.getOwner().getUsername())
                .totalRooms((int) p.getRooms().stream().filter(r -> !r.isDeleted()).count())
                .electricUnitPrice(p.getElectricUnitPrice())
                .waterUnitPrice(p.getWaterUnitPrice())
                .serviceUnitPrice(p.getServiceUnitPrice())
                .networkFee(p.getNetworkFee())
                .createdAt(p.getCreatedAt())
                .build();
    }
}
