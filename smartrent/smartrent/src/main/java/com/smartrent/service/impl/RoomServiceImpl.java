package com.smartrent.service.impl;

import com.smartrent.dto.request.RoomRequest;
import com.smartrent.dto.response.RoomResponse;
import com.smartrent.entity.Property;
import com.smartrent.entity.Room;
import com.smartrent.repository.InvoiceRepository;
import com.smartrent.repository.PropertyRepository;
import com.smartrent.repository.RoomRepository;
import com.smartrent.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.smartrent.entity.Invoice;
import java.time.LocalDateTime;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class RoomServiceImpl implements RoomService {

    private final RoomRepository roomRepository;
    private final PropertyRepository propertyRepository;
    private final InvoiceRepository invoiceRepository;

    @Override
    public RoomResponse create(RoomRequest request) {
        Property property = propertyRepository.findByIdAndDeletedFalse(request.getPropertyId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khu trọ id: " + request.getPropertyId()));

        if (roomRepository.existsByRoomNumberAndPropertyIdAndDeletedFalse(request.getRoomNumber(), request.getPropertyId())) {
            throw new RuntimeException("Phòng số '" + request.getRoomNumber() + "' đã tồn tại trong khu trọ này");
        }

        Room room = Room.builder()
                .roomNumber(request.getRoomNumber())
                .price(request.getPrice())
                .area(request.getArea())
                .description(request.getDescription())
                .imageUrl(request.getImageUrl())
                .property(property)
                .build();

        return toResponse(roomRepository.save(room));
    }

    @Override
    @Transactional(readOnly = true)
    public RoomResponse getById(Long id) {
        return toResponse(findById(id));
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoomResponse> getAll() {
        return roomRepository.findAllWithProperty().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoomResponse> getByProperty(Long propertyId) {
        return roomRepository.findByPropertyIdAndDeletedFalse(propertyId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoomResponse> getByPropertyAndStatus(Long propertyId, Room.Status status) {
        return roomRepository.findByPropertyIdAndStatusAndDeletedFalse(propertyId, status).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public RoomResponse update(Long id, RoomRequest request) {
        Room room = findById(id);
        if (roomRepository.existsByRoomNumberAndPropertyIdAndIdNotAndDeletedFalse(request.getRoomNumber(), room.getProperty().getId(), id)) {
            throw new RuntimeException("Phòng số '" + request.getRoomNumber() + "' đã tồn tại trong khu trọ này");
        }
        room.setRoomNumber(request.getRoomNumber());
        room.setPrice(request.getPrice());
        room.setArea(request.getArea());
        room.setDescription(request.getDescription());
        room.setImageUrl(request.getImageUrl());
        return toResponse(roomRepository.save(room));
    }

    @Override
    public RoomResponse updateStatus(Long id, Room.Status status) {
        Room room = findById(id);
        if (room.getStatus() == Room.Status.OCCUPIED) {
            throw new RuntimeException(
                    "Phòng " + room.getRoomNumber() + " đang có khách thuê, không thể đổi trạng thái. Hãy chấm dứt hợp đồng trước.");
        }
        room.setStatus(status);
        return toResponse(roomRepository.save(room));
    }

    @Override
    public void delete(Long id) {
        Room room = findById(id);
        if (room.getStatus() == Room.Status.OCCUPIED) {
            throw new RuntimeException("Không thể xóa phòng đang có người thuê. Hãy chấm dứt hợp đồng trước.");
        }
        if (invoiceRepository.existsByContractRoomIdAndStatusAndDeletedFalse(
                room.getId(), Invoice.Status.PAID)) {
            throw new RuntimeException("Không thể xóa: Phòng đã có lịch sử thu tiền, cần lưu trữ để đối soát tài chính");
        }
        String deletedBy = getCurrentUsername();
        room.setDeleted(true);
        room.setDeletedAt(LocalDateTime.now());
        room.setDeletedBy(deletedBy);
        roomRepository.save(room);
    }

    private Room findById(Long id) {
        return roomRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phòng id: " + id));
    }

    private String getCurrentUsername() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) return "system";
        String username = authentication.getName();
        if (username == null || username.isBlank() || "anonymousUser".equalsIgnoreCase(username)) return "system";
        return username;
    }

    private RoomResponse toResponse(Room r) {
        return RoomResponse.builder()
                .id(r.getId())
                .roomNumber(r.getRoomNumber())
                .price(r.getPrice())
                .area(r.getArea())
                .description(r.getDescription())
                .imageUrl(r.getImageUrl())
                .status(r.getStatus())
                .propertyId(r.getProperty().getId())
                .propertyName(r.getProperty().getName())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
