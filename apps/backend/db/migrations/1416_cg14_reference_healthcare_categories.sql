-- CG-14 US004: the client reference shows distinct professional/provider
-- categories. Retain existing recorded values; a category is only a verified
-- listing classification, never proof of a license, service or appointment.
ALTER TABLE health_center DROP CONSTRAINT health_center_center_type_check;
ALTER TABLE health_center ADD CONSTRAINT health_center_center_type_check CHECK(
 center_type IN(
 'HOSPITAL','CLINIC','DIAGNOSTIC_LAB','PHARMACY','NURSING','OTHER',
 'POLYCLINIC','DIAGNOSTIC_CENTER','DENTAL_CLINIC','MEDICAL_LABORATORY',
 'NURSING_HOME','ORTHOPEDIC_CLINIC','HOMEOPATHY_CLINIC','AYURVEDIC_CLINIC'
 ));
