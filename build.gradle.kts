plugins {
	java
	id("org.springframework.boot") version "3.5.14"
	id("io.spring.dependency-management") version "1.1.7"
}

group = "com.commerce"
// GitHub Actions 릴리즈 시: ./gradlew bootJar -Pversion=X.Y.Z
// 로컬 개발 시: 0.2.1-SNAPSHOT (기본값)
version = if (project.hasProperty("version") &&
              project.property("version").toString().isNotBlank() &&
              project.property("version").toString() != "unspecified")
    project.property("version").toString()
else
    "0.2.1-SNAPSHOT"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

extra["springAiVersion"] = "1.1.7"

dependencies {
	implementation("org.springframework.boot:spring-boot-starter")
	implementation("org.springframework.ai:spring-ai-autoconfigure-mcp-server-common")
	implementation("org.springframework.ai:spring-ai-mcp")
	implementation("org.springframework.ai:spring-ai-mcp-annotations")
	implementation("com.fasterxml.jackson.dataformat:jackson-dataformat-yaml")
	// Already present through MCP; declare the validator used at the Tool boundary directly.
	implementation("com.networknt:json-schema-validator:2.0.0")
	// 현재 테스트는 Mockito를 사용하지 않는다. starter-test의 inline mock maker는
	// 일부 제한된 JDK 환경에서 agent attach 실패를 일으키므로 필요한 테스트 모듈만 사용한다.
	testImplementation("org.springframework.boot:spring-boot-test")
	testImplementation("org.springframework.boot:spring-boot-test-autoconfigure")
	testImplementation("org.junit.jupiter:junit-jupiter")
	testImplementation("org.assertj:assertj-core")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

dependencyManagement {
	imports {
		mavenBom("org.springframework.ai:spring-ai-bom:${property("springAiVersion")}")
	}
}

tasks.withType<Test> {
	useJUnitPlatform()
}

tasks.register("validateKnowledge") {
	group = "verification"
	description = "Validates knowledge YAML binding, schema, categories, and quality rules."
	dependsOn("test")
}
