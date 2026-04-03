package com.smartrent.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class RoomRequest {

    @NotBlank(message = "So phong khong duoc de trong")
    @Size(max = 20)
    private String roomNumber;

    @NotNull(message = "Gia thue khong duoc de trong")
    @DecimalMin(value = "0.0", inclusive = false, message = "Gia phai lon hon 0")
    private BigDecimal price;

    @NotNull(message = "Dien tich khong duoc de trong")
    @Min(value = 1, message = "Dien tich toi thieu 1 m2")
    private Integer area;

    @Size(max = 2000, message = "Chi tiet phong toi da 2000 ky tu")
    private String description;

    private String imageUrl;

    @NotNull(message = "ID khu tro khong duoc de trong")
    private Long propertyId;
}

