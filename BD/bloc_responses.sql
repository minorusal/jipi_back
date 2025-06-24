CREATE TABLE bloc_responses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_json LONGTEXT,
    endpoint_name VARCHAR(100) NOT NULL,
    request_url TEXT,
    http_status SMALLINT,
    response_time_ms INT,
    response_json LONGTEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
