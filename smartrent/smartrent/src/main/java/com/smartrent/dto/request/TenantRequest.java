package com.smartrent.dto.request;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class TenantRequest {

    @NotBlank(message = "Họ tên không được để trống")
    @Size(max = 100)
    private String fullName;

    @NotBlank(message = "Số điện thoại không được để trống")
    @Pattern(regexp = "^(0[3|5|7|8|9])+([0-9]{8})$", message = "Số điện thoại không hợp lệ")
    private String phone;

    @Email(message = "Email không hợp lệ")
    private String email;

    @Size(max = 20)
    private String idCardNumber;
}