package cn.hb.wk.controller;

import cn.hb.wk.pojo.CommonResult;
import cn.hb.wk.controller.vo.imports.ImportStartReqVO;
import cn.hb.wk.controller.vo.imports.ImportProgressRespVO;
import cn.hb.wk.controller.vo.imports.ImportNextReqVO;
import cn.hb.wk.controller.vo.imports.ImportCompleteReqVO;
import cn.hb.wk.controller.vo.imports.ImportCompleteRespVO;
import cn.hb.wk.service.importing.ImportService;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import cn.hb.wk.service.file.NovelFileParseService;

import static cn.hb.wk.pojo.CommonResult.success;

@RestController
@RequestMapping("/app-api/api/novels/import")
public class ImportController {
    @Resource
    private ImportService importService;
    @Resource
    private NovelFileParseService fileParseService;

    /**
     * 启动导入任务（JSON）
     */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public CommonResult<ImportProgressRespVO> startImportJson(@Valid @RequestBody ImportStartReqVO body) {
        String taskId = importService.startImport(body.getType(), body.getContent(), body.getFileName());
        ImportService.Progress p = importService.getProgress(taskId);
        return success(toResp(p));
    }

    /**
     * 启动导入任务（文件）
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CommonResult<ImportProgressRespVO> startImportFile(@RequestParam("file") MultipartFile file,
                                                              @RequestParam(value = "type", required = false) String type) throws Exception {
        long max = 10L * 1024 * 1024;
        if (file.getSize() > max) {
            throw new IllegalArgumentException("文件大小超过 10MB");
        }
        String fileName = file.getOriginalFilename();
        String ext = fileName != null && fileName.contains(".") ? fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase() : "";
        if (!(ext.equals("txt") || ext.equals("md") || ext.equals("docx"))) {
            throw new IllegalArgumentException("不支持的文件类型，仅支持 txt/md/docx (当前文件: " + fileName + ")");
        }
        String content = fileParseService.parseFile(file);
        String taskId = importService.startImport(type, content, fileName);
        ImportService.Progress p = importService.getProgress(taskId);
        return success(toResp(p));
    }

    /**
     * 查询导入进度
     */
    @GetMapping("/progress")
    public CommonResult<ImportProgressRespVO> getProgress(@RequestParam("taskId") String taskId) {
        ImportService.Progress p = importService.getProgress(taskId);
        return success(toResp(p));
    }

    /**
     * 推进到下一步
     */
    @PostMapping("/next")
    public CommonResult<ImportProgressRespVO> next(@Valid @RequestBody ImportNextReqVO body) {
        ImportService.Progress p = importService.next(body.getTaskId(), body.getForce());
        return success(toResp(p));
    }

    /**
     * 完成导入流程
     */
    @PostMapping("/complete")
    public CommonResult<ImportCompleteRespVO> complete(@Valid @RequestBody ImportCompleteReqVO body) {
        Long projectId = importService.complete(body.getTaskId());
        ImportCompleteRespVO resp = new ImportCompleteRespVO();
        resp.setProjectId(projectId);
        resp.setRedirect(projectId != null ? ("/editor/" + projectId) : null);
        return success(resp);
    }

    private ImportProgressRespVO toResp(ImportService.Progress p) {
        ImportProgressRespVO resp = new ImportProgressRespVO();
        resp.setTaskId(p.getTaskId());
        resp.setStep(p.getStep());
        resp.setTotal(p.getTotal());
        resp.setStatus(p.getStatus());
        resp.setMessage(p.getMessage());
        resp.setJobId(p.getJobId());
        resp.setProjectId(p.getProjectId());
        resp.setCurrentStep(p.getCurrentStep());
        resp.setSteps(p.getSteps());
        resp.setFinishedSteps(p.getFinishedSteps());
        resp.setGeneratedCount(p.getGeneratedCount());
        resp.setGeneratedType(p.getGeneratedType());
        resp.setError(p.getError());
        return resp;
    }
}
