package com.smartrent.dto.response;

import com.smartrent.entity.Room;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
public class RoomResponse {
    private Long id;
    private String roomNumber;
    private BigDecimal price;
    private Integer area;
    private String description;
    private String imageUrl;
    private Room.Status status;
    private Long propertyId;
    private String propertyName;
    private LocalDateTime createdAt;
}

