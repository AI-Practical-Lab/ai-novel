package cn.iocoder.yudao.service.importing;

public interface ImportService {
    String startImport(String type, String content, String fileName);
    Progress getProgress(String taskId);
    Progress next(String taskId, Boolean force);
    Long complete(String taskId);

    class Progress {
        private String taskId;
        private String jobId;
        private Long projectId;
        private Integer step;
        private Integer total;
        private String status;
        private String message;
        private java.util.List<String> steps;
        private String currentStep;
        private java.util.List<String> finishedSteps;
        private String error;
        private Integer generatedCount;
        private String generatedType;

        public String getTaskId() {
            return taskId;
        }

        public void setTaskId(String taskId) {
            this.taskId = taskId;
        }

        public String getJobId() {
            return jobId;
        }

        public void setJobId(String jobId) {
            this.jobId = jobId;
        }

        public Long getProjectId() {
            return projectId;
        }

        public void setProjectId(Long projectId) {
            this.projectId = projectId;
        }

        public Integer getStep() {
            return step;
        }

        public void setStep(Integer step) {
            this.step = step;
        }

        public Integer getTotal() {
            return total;
        }

        public void setTotal(Integer total) {
            this.total = total;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public java.util.List<String> getSteps() {
            return steps;
        }

        public void setSteps(java.util.List<String> steps) {
            this.steps = steps;
        }

        public String getCurrentStep() {
            return currentStep;
        }

        public void setCurrentStep(String currentStep) {
            this.currentStep = currentStep;
        }

        public java.util.List<String> getFinishedSteps() {
            return finishedSteps;
        }

        public void setFinishedSteps(java.util.List<String> finishedSteps) {
            this.finishedSteps = finishedSteps;
        }

        public String getError() {
            return error;
        }

        public void setError(String error) {
            this.error = error;
        }

        public Integer getGeneratedCount() {
            return generatedCount;
        }

        public void setGeneratedCount(Integer generatedCount) {
            this.generatedCount = generatedCount;
        }

        public String getGeneratedType() {
            return generatedType;
        }

        public void setGeneratedType(String generatedType) {
            this.generatedType = generatedType;
        }
    }
}
