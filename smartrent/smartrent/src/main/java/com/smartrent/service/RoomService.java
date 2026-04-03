package com.smartrent.service;

import com.smartrent.dto.request.RoomRequest;
import com.smartrent.dto.response.RoomResponse;
import com.smartrent.entity.Room;

import java.util.List;

public interface RoomService {
    RoomResponse create(RoomRequest request);
    RoomResponse getById(Long id);
    List<RoomResponse> getByProperty(Long propertyId);
    List<RoomResponse> getByPropertyAndStatus(Long propertyId, Room.Status status);
    RoomResponse update(Long id, RoomRequest request);
    RoomResponse updateStatus(Long id, Room.Status status);
    void delete(Long id);
}