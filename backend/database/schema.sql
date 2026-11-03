-- Reference schema for LostLink. Back up your database before applying.
-- If tables already exist, do NOT drop them. Compare column names first.
CREATE DATABASE IF NOT EXISTS lost_found_portal;
USE lost_found_portal;

CREATE TABLE IF NOT EXISTS users (
 user_id INT AUTO_INCREMENT PRIMARY KEY,
 full_name VARCHAR(120) NOT NULL,
 email VARCHAR(190) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 role ENUM('student','faculty','admin') NOT NULL DEFAULT 'student',
 department VARCHAR(100) NULL,
 is_active TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS categories (
 category_id INT AUTO_INCREMENT PRIMARY KEY,
 category_name VARCHAR(100) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS items (
 item_id INT AUTO_INCREMENT PRIMARY KEY,
 user_id INT NOT NULL,
 category_id INT NULL,
 item_name VARCHAR(180) NOT NULL,
 description TEXT NOT NULL,
 item_type ENUM('lost','found') NOT NULL,
 location VARCHAR(180) NOT NULL,
 item_date DATE NOT NULL,
 image_path VARCHAR(255) NULL,
 status ENUM('open','claimed','returned','closed','rejected') NOT NULL DEFAULT 'open',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY (user_id) REFERENCES users(user_id),
 FOREIGN KEY (category_id) REFERENCES categories(category_id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS claims (
 claim_id INT AUTO_INCREMENT PRIMARY KEY,
 item_id INT NOT NULL,
 claimant_id INT NOT NULL,
 proof_details TEXT NOT NULL,
 status ENUM('pending','approved','rejected','completed') NOT NULL DEFAULT 'pending',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (item_id) REFERENCES items(item_id) ON DELETE CASCADE,
 FOREIGN KEY (claimant_id) REFERENCES users(user_id) ON DELETE CASCADE
);
INSERT IGNORE INTO categories(category_name) VALUES
('Bags'),('Books and Notebooks'),('Clothing'),('Documents'),('Electronics'),
('ID Cards'),('Jewelry'),('Keys'),('Stationery'),('Wallets and Purses'),('Water Bottles'),('Other');
