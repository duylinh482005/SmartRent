package com.smartrent.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class PropertyRequest {

    @NotBlank(message = "Tên khu trọ không được để trống")
    @Size(max = 100, message = "Tên tối đa 100 ký tự")
    private String name;

    @NotBlank(message = "Địa chỉ không được để trống")
    @Size(max = 255, message = "Địa chỉ tối đa 255 ký tự")
    private String address;

    private String description;

    private Long ownerId;

    @DecimalMin(value = "0", message = "Đơn giá điện phải >= 0")
    private BigDecimal electricUnitPrice;

    @DecimalMin(value = "0", message = "Đơn giá nước phải >= 0")
    private BigDecimal waterUnitPrice;

    @DecimalMin(value = "0", message = "Đơn giá dịch vụ phải >= 0")
    private BigDecimal serviceUnitPrice;

    @DecimalMin(value = "0", message = "Đơn giá mạng phải >= 0")
    private BigDecimal networkFee;
}