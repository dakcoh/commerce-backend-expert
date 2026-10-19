import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.jar.*;

// Run with the JDK; the launcher and published npm package gain no dependency.
class VerifyArtifact {
    public static void main(String[] args) throws Exception {
        if (args.length != 2) throw new IllegalArgumentException("Usage: java scripts/VerifyArtifact.java <jar> <version>");
        var inventory = new TreeMap<String, String>();
        var packagedYaml = new TreeSet<String>();
        int classes = 0;
        try (var jar = new JarFile(args[0])) {
            if (!args[1].equals(jar.getManifest().getMainAttributes().getValue("Implementation-Version")))
                throw new IllegalStateException("JAR manifest version mismatch");
            for (var entry : Collections.list(jar.entries())) {
                String name = entry.getName();
                if (name.startsWith("BOOT-INF/classes/") && name.endsWith(".class")) {
                    try (var input = new DataInputStream(jar.getInputStream(entry))) {
                        if (input.readInt() != 0xcafebabe) throw new IllegalStateException("Invalid class: " + name);
                        input.readUnsignedShort();
                        if (input.readUnsignedShort() != 65) throw new IllegalStateException("Java 21 bytecode required: " + name);
                    }
                    classes++;
                }
                if (name.startsWith("BOOT-INF/classes/knowledge/") && name.endsWith(".yml")) {
                    String file = name.substring("BOOT-INF/classes/knowledge/".length());
                    if (file.contains("/")) throw new IllegalStateException("Unexpected knowledge path: " + file);
                    packagedYaml.add(file);
                    try (var input = jar.getInputStream(entry)) {
                        if (!Arrays.equals(input.readAllBytes(), Files.readAllBytes(Path.of("src/main/resources/knowledge", file))))
                            throw new IllegalStateException("Packaged knowledge differs: " + file);
                    }
                }
                if (name.startsWith("BOOT-INF/lib/") && name.endsWith(".jar")) {
                    String library = name.substring("BOOT-INF/lib/".length());
                    if (!library.matches("[a-zA-Z0-9_.-]+\\.jar")) throw new IllegalStateException("Unexpected library path");
                    if (library.matches("(?:tomcat-.*|jetty-.*|undertow-.*|spring-web(?:mvc|flux)?-.*|spring-boot-actuator.*|reactor-netty-.*)"))
                        throw new IllegalStateException("Web server/Actuator dependency forbidden: " + library);
                    try (var input = jar.getInputStream(entry)) {
                        inventory.put(library, HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(input.readAllBytes())));
                    }
                }
            }
        }
        var sourceYaml = new TreeSet<String>();
        try (var files = Files.list(Path.of("src/main/resources/knowledge"))) {
            files.filter(p -> p.toString().endsWith(".yml")).forEach(p -> sourceYaml.add(p.getFileName().toString()));
        }
        if (classes == 0 || inventory.isEmpty() || sourceYaml.isEmpty() || !sourceYaml.equals(packagedYaml))
            throw new IllegalStateException("Missing classes, dependencies, or knowledge files");
        var output = new StringBuilder("# version=" + args[1] + " classes=" + classes + " major=65 yaml=" + packagedYaml.size() + "\n");
        output.append("library\tsha256\n");
        inventory.forEach((name, hash) -> output.append(name).append('\t').append(hash).append('\n'));
        System.out.print(output);
    }
}
