package com.smartrent.service;

import org.springframework.web.multipart.MultipartFile;

public interface FileStorageService {

    String storeRoomImage(MultipartFile file);
}

