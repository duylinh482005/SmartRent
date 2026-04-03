package com.smartrent.service.impl;

import com.smartrent.dto.request.RoomRequest;
import com.smartrent.dto.response.RoomResponse;
import com.smartrent.entity.Property;
import com.smartrent.entity.Room;
import com.smartrent.repository.PropertyRepository;
import com.smartrent.repository.RoomRepository;
import com.smartrent.service.RoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class RoomServiceImpl implements RoomService {

    private final RoomRepository roomRepository;
    private final PropertyRepository propertyRepository;

    @Override
    public RoomResponse create(RoomRequest request) {
        Property property = propertyRepository.findById(request.getPropertyId())
                .orElseThrow(() -> new RuntimeException("Không tìm thấy khu trọ id: " + request.getPropertyId()));

        if (roomRepository.existsByRoomNumberAndPropertyId(request.getRoomNumber(), request.getPropertyId())) {
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
    public List<RoomResponse> getByProperty(Long propertyId) {
        return roomRepository.findByPropertyId(propertyId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoomResponse> getByPropertyAndStatus(Long propertyId, Room.Status status) {
        return roomRepository.findByPropertyIdAndStatus(propertyId, status).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public RoomResponse update(Long id, RoomRequest request) {
        Room room = findById(id);
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
        room.setStatus(status);
        return toResponse(roomRepository.save(room));
    }

    @Override
    public void delete(Long id) {
        roomRepository.delete(findById(id));
    }

    private Room findById(Long id) {
        return roomRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Không tìm thấy phòng id: " + id));
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
