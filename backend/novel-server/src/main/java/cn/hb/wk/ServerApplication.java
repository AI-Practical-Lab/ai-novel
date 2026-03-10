package cn.hb.wk;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 项目的启动类
 *
 */
@SuppressWarnings("SpringComponentScan") // 忽略 IDEA 无法识别 ${yudao.info.base-package}
@SpringBootApplication(scanBasePackages = {"cn.hb.wk"})
public class ServerApplication {

    public static void main(String[] args) {


        SpringApplication.run(ServerApplication.class, args);
    }

}
