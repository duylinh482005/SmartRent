package com.smartrent.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class PropertyResponse {
    private Long id;
    private String name;
    private String address;
    private String description;
    private Long ownerId;
    private String ownerUsername;
    private int totalRooms;
    private LocalDateTime createdAt;
}