# Universal Object Holder (UOH)

## Goal
The Universal Object Holder (UOH) is a modular and extensible utility designed to abstract, transform, and validate payloads for various AI models and APIs. Its primary goal is to simplify the integration of multiple AI services by providing a unified interface for payload management, ensuring consistency, and reducing development overhead.

## Status
The UOH is currently in **Version 1.0** and includes the following features:
- Payload transformation for OpenAI and Hugging Face APIs.
- Dynamic field validation with support for types and constraints.
- Custom error handling for validation and adapter errors.
- Configurable debugging levels for granular logging.
- Support for versioned adapters and extensibility for new models.

The UOH has been tested with basic use cases and is ready for integration into production environments. Future updates will focus on adding more adapters, enhancing validation, and improving performance.

---

## Key Features

### 1. Payload Transformation
- Converts a universal payload into model-specific formats (e.g., OpenAI, Hugging Face).
- Supports versioned adapters for backward compatibility.

### 2. Dynamic Validation
- Validates payloads against model-specific rules.
- Supports field types (e.g., string, number) and constraints (e.g., min, max).

### 3. Error Handling
- Custom error classes (`ValidationError`, `AdapterError`) for clear debugging.
- Centralized error logging with configurable levels.

### 4. Debugging
- Configurable debugging levels (`none`, `error`, `info`, `debug`).
- Logs payload transformations and validation results.

### 5. Extensibility
- Easy to add new adapters and validation rules.
- Supports versioning for adapters.

---

## Usage

### Installation
1. Include the `UniObjectHolder.js` file in your project.
2. Import the class:
   ```javascript
   import { UniObjectHolder } from './UniObjectHolder.js';



Future Development
1. Adapter Expansion
Add adapters for additional AI models and APIs (e.g., Cohere, Anthropic, custom models).

Support for real-time API updates and versioning.

2. Enhanced Validation
Add support for regex patterns, custom validators, and nested object validation.

Implement lazy validation for optional fields.

3. Performance Optimizations
Add batch transformation support for handling multiple payloads simultaneously.

Optimize validation and transformation logic for large payloads.

4. Documentation and Testing
Write comprehensive documentation for all methods and use cases.

Add unit tests using Jest or Mocha to ensure reliability.

5. Integration with Backend
Develop backend endpoints for storing and retrieving payloads and session history.

Integrate with a database (e.g., personavault.db) for persistent storage.

6. Monitoring and Logging
Add support for external logging services (e.g., Sentry, Loggly).

Implement monitoring for payload transformation and validation performance.

Contributing
Contributions are welcome! Please follow these steps:

Fork the repository.

Create a new branch for your feature or bugfix.

Submit a pull request with a detailed description of your changes.

License
The Universal Object Holder (UOH) is released under the MIT License. See the LICENSE file for details.

Contact
For questions or feedback, please contact:

Project Lead: Rajinder Jhol

Email: jholrajinder@gmail.com 

GitHub: https://github.com/rajinderjhol
Linkedin: https://www.linkedin.com/in/rjhol/ 



---

### **Key Sections**

1. **Goal**: Explains the purpose of the UOH.
2. **Status**: Describes the current state of the project.
3. **Key Features**: Lists the core functionalities.
4. **Usage**: Provides examples and instructions for using the UOH.
5. **Future Development**: Outlines planned improvements and features.
6. **Contributing**: Guidelines for contributing to the project.
7. **License**: Information about the project's license.
8. **Contact**: Contact details for the project lead.

---

This `ReadMeUOH.txt` file serves as a comprehensive guide for developers and stakeholders, ensuring clarity and alignment on the project's goals and future direction. Let me know if you need further adjustments!

### `test2` Function
The `test2` function handles minimal payloads and saves them to the `memories` table. It uses the following columns:
- `memory_type`: Set to `'payload'`.
- `content`: Stores the transformed payload as a JSON string.
- `tags`: Stores metadata like the model name and version.
- `privacy_level`: Set to `'private'` by default.
- `expiry_days`: Set to `7` by default.