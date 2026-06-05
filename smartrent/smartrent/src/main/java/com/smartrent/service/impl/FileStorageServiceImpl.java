package com.smartrent.service.impl;

import com.smartrent.service.FileStorageService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class FileStorageServiceImpl implements FileStorageService {

    private static final List<String> ALLOWED_EXTENSIONS = List.of(".jpg", ".jpeg", ".png", ".webp", ".gif");

    private final Path uploadRootDir;

    public FileStorageServiceImpl(@Value("${app.upload.dir:uploads}") String uploadDir) {
        this.uploadRootDir = Path.of(uploadDir).toAbsolutePath().normalize();
    }

    @Override
    public String storeRoomImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("File ảnh không hợp lệ");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new RuntimeException("Chỉ hỗ trợ upload file ảnh");
        }

        String extension = extractAndValidateExtension(file.getOriginalFilename());
        String fileName = UUID.randomUUID() + extension;

        Path roomDir = uploadRootDir.resolve("rooms");
        Path targetFile = roomDir.resolve(fileName);

        try {
            Files.createDirectories(roomDir);
            Files.copy(file.getInputStream(), targetFile, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new RuntimeException("Không thể lưu file ảnh", e);
        }

        return "/uploads/rooms/" + fileName;
    }

    @Override
    public String storeQrImage(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new RuntimeException("File QR không hợp lệ");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new RuntimeException("Chỉ hỗ trợ upload file ảnh QR");
        }

        String extension = extractAndValidateExtension(file.getOriginalFilename());
        String fileName = UUID.randomUUID() + extension;

        Path qrDir = uploadRootDir.resolve("qr");
        Path targetFile = qrDir.resolve(fileName);

        try {
            Files.createDirectories(qrDir);
            Files.copy(file.getInputStream(), targetFile, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new RuntimeException("Không thể lưu file QR", e);
        }

        return "/uploads/qr/" + fileName;
    }

    private String extractAndValidateExtension(String originalName) {
        if (originalName == null || !originalName.contains(".")) {
            throw new RuntimeException("Định dạng file ảnh không hợp lệ");
        }

        String extension = originalName.substring(originalName.lastIndexOf(".")).toLowerCase(Locale.ROOT);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new RuntimeException("Chỉ chấp nhận ảnh JPG, PNG, WEBP hoặc GIF");
        }

        return extension;
    }
}

