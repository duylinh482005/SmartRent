package com.smartrent.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class RoomRequest {

    @NotBlank(message = "Số phòng không được để trống")
    @Size(max = 20)
    private String roomNumber;

    @NotNull(message = "Giá thuê không được để trống")
    @DecimalMin(value = "0.0", inclusive = false, message = "Giá phải lớn hơn 0")
    private BigDecimal price;

    @NotNull(message = "Diện tích không được để trống")
    @Min(value = 1, message = "Diện tích tối thiểu 1 m2")
    private Integer area;

    @Size(max = 2000, message = "Chi tiết phòng tối đa 2000 ký tự")
    private String description;

    private String imageUrl;

    @NotNull(message = "ID khu trọ không được để trống")
    private Long propertyId;
}

