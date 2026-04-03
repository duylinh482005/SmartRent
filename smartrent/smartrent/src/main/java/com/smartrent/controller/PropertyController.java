package com.smartrent.controller;

import com.smartrent.dto.request.PropertyRequest;
import com.smartrent.dto.response.PropertyResponse;
import com.smartrent.service.PropertyService;
import com.smartrent.util.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/properties")
@RequiredArgsConstructor
public class PropertyController {

    private final PropertyService propertyService;

    @PostMapping
    public ResponseEntity<ApiResponse<PropertyResponse>> create(
            @Valid @RequestBody PropertyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(propertyService.create(request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<PropertyResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(propertyService.getAll()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PropertyResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(propertyService.getById(id)));
    }

    @GetMapping("/owner/{ownerId}")
    public ResponseEntity<ApiResponse<List<PropertyResponse>>> getByOwner(
            @PathVariable Long ownerId) {
        return ResponseEntity.ok(ApiResponse.success(propertyService.getByOwner(ownerId)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<PropertyResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody PropertyRequest request) {
        return ResponseEntity.ok(ApiResponse.success(propertyService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        propertyService.delete(id);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}