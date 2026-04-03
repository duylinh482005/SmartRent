package com.smartrent.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "tenants")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Tenant extends BaseEntity {

    @Column(name = "full_name", nullable = false, length = 100)
    private String fullName;

    @Column(nullable = false, length = 15, unique = true)
    private String phone;

    @Column(length = 100)
    private String email;

    @Column(name = "id_card_number", length = 20, unique = true)
    private String idCardNumber;

    @OneToMany(mappedBy = "tenant", cascade = CascadeType.ALL)
    @Builder.Default
    private List<Contract> contracts = new ArrayList<>();
}