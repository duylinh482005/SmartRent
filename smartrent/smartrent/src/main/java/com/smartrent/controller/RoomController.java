package com.smartrent.controller;

import com.smartrent.dto.request.RoomRequest;
import com.smartrent.dto.response.RoomResponse;
import com.smartrent.entity.Room;
import com.smartrent.service.RoomService;
import com.smartrent.util.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rooms")
@RequiredArgsConstructor
public class RoomController {

    private final RoomService roomService;

    @PostMapping
    public ResponseEntity<ApiResponse<RoomResponse>> create(
            @Valid @RequestBody RoomRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(roomService.create(request)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<RoomResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(roomService.getById(id)));
    }

    @GetMapping("/property/{propertyId}")
    public ResponseEntity<ApiResponse<List<RoomResponse>>> getByProperty(
            @PathVariable Long propertyId,
            @RequestParam(required = false) Room.Status status) {
        List<RoomResponse> result = (status != null)
                ? roomService.getByPropertyAndStatus(propertyId, status)
                : roomService.getByProperty(propertyId);
        return ResponseEntity.ok(ApiResponse.success(result));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<RoomResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody RoomRequest request) {
        return ResponseEntity.ok(ApiResponse.success(roomService.update(id, request)));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<RoomResponse>> updateStatus(
            @PathVariable Long id,
            @RequestParam Room.Status status) {
        return ResponseEntity.ok(ApiResponse.success(roomService.updateStatus(id, status)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        roomService.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}