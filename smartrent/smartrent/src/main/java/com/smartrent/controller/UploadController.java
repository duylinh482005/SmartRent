package com.smartrent.controller;

import com.smartrent.service.FileStorageService;
import com.smartrent.util.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
@RequestMapping("/api/v1/uploads")
@RequiredArgsConstructor
public class UploadController {

    private final FileStorageService fileStorageService;

    @PostMapping("/rooms")
    public ResponseEntity<ApiResponse<String>> uploadRoomImage(@RequestParam("file") MultipartFile file) {
        String relativePath = fileStorageService.storeRoomImage(file);
        String absoluteUrl = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path(relativePath)
                .toUriString();
        return ResponseEntity.ok(ApiResponse.success(absoluteUrl));
    }

    @PostMapping("/qr")
    public ResponseEntity<ApiResponse<String>> uploadQrImage(@RequestParam("file") MultipartFile file) {
        String relativePath = fileStorageService.storeQrImage(file);
        String absoluteUrl = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path(relativePath)
                .toUriString();
        return ResponseEntity.ok(ApiResponse.success(absoluteUrl));
    }
}

