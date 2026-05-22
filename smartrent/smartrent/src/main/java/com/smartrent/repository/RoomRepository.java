package com.smartrent.repository;

import com.smartrent.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {
    List<Room> findByPropertyId(Long propertyId);
    List<Room> findByPropertyIdAndStatus(Long propertyId, Room.Status status);
    boolean existsByRoomNumberAndPropertyId(String roomNumber, Long propertyId);
    boolean existsByPropertyIdAndStatus(Long propertyId, Room.Status status);

    @Query("SELECT r FROM Room r JOIN FETCH r.property")
    List<Room> findAllWithProperty();
}