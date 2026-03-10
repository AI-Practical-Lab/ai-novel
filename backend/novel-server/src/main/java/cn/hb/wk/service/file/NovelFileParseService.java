package cn.hb.wk.service.file;

import cn.hb.wk.exception.ServiceException;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedInputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;

import static cn.hb.wk.exception.enums.GlobalErrorCodeConstants.BAD_REQUEST;

@Service
public class NovelFileParseService {
    public String parseFile(MultipartFile file) throws Exception {
        if (file.isEmpty()) {
            throw new ServiceException(BAD_REQUEST.getCode(), "文件内容不能为空");
        }
        String name = file.getOriginalFilename();
        String lower = name != null ? name.toLowerCase() : "";
        if (lower.endsWith(".txt") || lower.endsWith(".md")) {
            return decodeContent(file.getBytes());
        }
        if (lower.endsWith(".docx")) {
            try (InputStream in = new BufferedInputStream(file.getInputStream());
                 XWPFDocument doc = new XWPFDocument(in)) {
                List<String> lines = doc.getParagraphs().stream()
                        .map(XWPFParagraph::getText)
                        .collect(Collectors.toList());
                return String.join("\n", lines);
            } catch (Exception e) {
                throw new ServiceException(BAD_REQUEST.getCode(), "DOCX文件解析失败，请确认文件是否损坏或格式正确: " + e.getMessage());
            }
        }
        if (lower.endsWith(".pdf")) {
//            try (InputStream in = new BufferedInputStream(file.getInputStream());
//                 PDDocument doc = PDDocument.load(in)) {
//                PDFTextStripper stripper = new PDFTextStripper();
//                return stripper.getText(doc);
//            }
        }
        throw new IllegalArgumentException("不支持的文件类型");
    }

    private String decodeContent(byte[] bytes) {
        // 1. 尝试检测 BOM
        if (bytes.length >= 3 && bytes[0] == (byte) 0xEF && bytes[1] == (byte) 0xBB && bytes[2] == (byte) 0xBF) {
            return new String(bytes, 3, bytes.length - 3, StandardCharsets.UTF_8);
        }
        if (bytes.length >= 2 && bytes[0] == (byte) 0xFE && bytes[1] == (byte) 0xFF) {
            return new String(bytes, 2, bytes.length - 2, StandardCharsets.UTF_16BE);
        }
        if (bytes.length >= 2 && bytes[0] == (byte) 0xFF && bytes[1] == (byte) 0xFE) {
            return new String(bytes, 2, bytes.length - 2, StandardCharsets.UTF_16LE);
        }

        // 2. 尝试 UTF-8 (严格模式)
        try {
            CharsetDecoder decoder = StandardCharsets.UTF_8.newDecoder();
            decoder.onMalformedInput(CodingErrorAction.REPORT);
            decoder.onUnmappableCharacter(CodingErrorAction.REPORT);
            return decoder.decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException e) {
            // 忽略，继续尝试 GBK
        } catch (Exception e) {
            // 忽略
        }

        // 3. 尝试 GBK (兼容 GB2312/GB18030)
        try {
            CharsetDecoder decoder = Charset.forName("GBK").newDecoder();
            decoder.onMalformedInput(CodingErrorAction.REPORT);
            decoder.onUnmappableCharacter(CodingErrorAction.REPORT);
            return decoder.decode(ByteBuffer.wrap(bytes)).toString();
        } catch (Exception e) {
            // 忽略
        }

        // 4. 尝试 Big5 (繁体)
        try {
            CharsetDecoder decoder = Charset.forName("Big5").newDecoder();
            decoder.onMalformedInput(CodingErrorAction.REPORT);
            decoder.onUnmappableCharacter(CodingErrorAction.REPORT);
            return decoder.decode(ByteBuffer.wrap(bytes)).toString();
        } catch (Exception e) {
            // 忽略
        }

        // 5. 兜底使用 UTF-8 (即使有乱码也返回，避免空指针)
        return new String(bytes, StandardCharsets.UTF_8);
    }
}
